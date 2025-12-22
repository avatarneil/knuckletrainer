/**
 * AI Worker Manager
 *
 * Manages communication with the AI Web Worker for offloading
 * heavy computation from the main thread.
 */

import type { DifficultyConfig } from "@/engine/ai/difficulty";
import type {
  ColumnIndex,
  DifficultyLevel,
  GameState,
  MoveAnalysis,
} from "@/engine/types";
import { getAIPerformanceConfig, getPlatformInfo } from "./platform";

/** Pending request waiting for worker response */
interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/** Worker message type */
interface WorkerMessage {
  id: string;
  type: "success" | "error";
  result?: unknown;
  error?: string;
}

/** Singleton worker instance */
let workerInstance: Worker | null = null;
const pendingRequests: Map<string, PendingRequest> = new Map();
let requestIdCounter = 0;
let workerInitialized = false;

/**
 * Initialize the AI worker
 */
export function initializeAIWorker(): Worker | null {
  if (typeof window === "undefined") {
    return null;
  }

  const platform = getPlatformInfo();

  if (!platform.supportsWorkers) {
    console.log("Web Workers not supported, AI will run on main thread");
    return null;
  }

  if (workerInstance) {
    return workerInstance;
  }

  try {
    workerInstance = new Worker("/ai-worker.js");

    workerInstance.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const { id, type, result, error } = event.data;

      const pending = pendingRequests.get(id);
      if (!pending) {
        return;
      }

      clearTimeout(pending.timeout);
      pendingRequests.delete(id);

      if (type === "success") {
        pending.resolve(result);
      } else {
        pending.reject(new Error(error || "Worker error"));
      }
    };

    workerInstance.onerror = (error) => {
      console.error("AI Worker error:", error);
      // Reject all pending requests
      for (const [id, pending] of pendingRequests) {
        clearTimeout(pending.timeout);
        pending.reject(new Error("Worker error"));
        pendingRequests.delete(id);
      }
    };

    workerInitialized = true;
    return workerInstance;
  } catch (error) {
    console.error("Failed to initialize AI worker:", error);
    return null;
  }
}

/**
 * Check if the worker is available and initialized
 */
export function isWorkerAvailable(): boolean {
  return workerInitialized && workerInstance !== null;
}

/**
 * Terminate the worker
 */
export function terminateAIWorker(): void {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
    workerInitialized = false;

    // Clean up pending requests
    for (const [, pending] of pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Worker terminated"));
    }
    pendingRequests.clear();
  }
}

/**
 * Send a message to the worker and wait for response
 */
function sendToWorker<T>(
  type: string,
  payload: Record<string, unknown>,
  timeout = 30000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!workerInstance) {
      reject(new Error("Worker not initialized"));
      return;
    }

    const id = `req_${++requestIdCounter}`;

    const timeoutHandle = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Worker request timed out: ${type}`));
    }, timeout);

    pendingRequests.set(id, {
      resolve: resolve as (value: unknown) => void,
      reject,
      timeout: timeoutHandle,
    });

    workerInstance.postMessage({ type, payload, id });
  });
}

/**
 * Get the best move using the worker
 */
export async function getBestMoveAsync(
  state: GameState,
  config: DifficultyConfig,
): Promise<ColumnIndex | null> {
  const performanceConfig = getAIPerformanceConfig();

  return sendToWorker<ColumnIndex | null>("getBestMove", {
    state,
    config,
    performanceConfig,
  });
}

/**
 * Run expectimax search using the worker
 */
export async function expectimaxAsync(
  state: GameState,
  player: "player1" | "player2",
  config: DifficultyConfig,
): Promise<{
  bestMove: ColumnIndex | null;
  value: number;
  nodesExplored: number;
}> {
  const performanceConfig = getAIPerformanceConfig();

  return sendToWorker("expectimax", {
    state,
    player,
    config,
    performanceConfig,
  });
}

/**
 * Analyze all moves using Monte Carlo simulation
 */
export async function analyzeAllMovesAsync(
  state: GameState,
  config: {
    simulations: number;
    policy: "random" | "heuristic" | "mixed";
    heuristicRatio: number;
  },
): Promise<{
  moves: MoveAnalysis[];
  bestMove: ColumnIndex | null;
  simulationsPerMove: number;
}> {
  return sendToWorker("analyzeAllMoves", { state, config });
}

/**
 * Quick analysis with fewer simulations
 */
export async function quickAnalysisAsync(
  state: GameState,
  simulations?: number,
): Promise<{
  moves: MoveAnalysis[];
  bestMove: ColumnIndex | null;
  simulationsPerMove: number;
}> {
  const performanceConfig = getAIPerformanceConfig();
  const sims = simulations ?? performanceConfig.monteCarloSimulations;

  return sendToWorker("quickAnalysis", { state, simulations: sims });
}

/**
 * Deep analysis with more simulations
 */
export async function deepAnalysisAsync(
  state: GameState,
  simulations?: number,
): Promise<{
  moves: MoveAnalysis[];
  bestMove: ColumnIndex | null;
  simulationsPerMove: number;
}> {
  const performanceConfig = getAIPerformanceConfig();
  // For deep analysis, use double the configured simulations
  const sims = simulations ?? performanceConfig.monteCarloSimulations * 2;

  return sendToWorker("deepAnalysis", { state, simulations: sims });
}

/**
 * AI Player using Web Worker
 *
 * This class provides an async interface to the AI that uses the
 * Web Worker when available, falling back to sync main-thread
 * computation when not.
 */
export class AsyncAIPlayer {
  private difficulty: DifficultyLevel;
  private useWorker: boolean;

  constructor(difficulty: DifficultyLevel = "medium") {
    this.difficulty = difficulty;
    const config = getAIPerformanceConfig();
    this.useWorker = config.useWorker && isWorkerAvailable();
  }

  setDifficulty(level: DifficultyLevel): void {
    this.difficulty = level;
  }

  getDifficulty(): DifficultyLevel {
    return this.difficulty;
  }

  /**
   * Choose a move asynchronously using the worker if available
   */
  async chooseMoveAsync(state: GameState): Promise<ColumnIndex | null> {
    // Import the difficulty config
    const { getDifficultyConfig } = await import("@/engine/ai/difficulty");
    const config = getDifficultyConfig(this.difficulty);

    if (this.useWorker && isWorkerAvailable()) {
      try {
        return await getBestMoveAsync(state, config);
      } catch (error) {
        console.error("Worker error, falling back to main thread:", error);
        // Fall back to main thread
      }
    }

    // Fall back to synchronous main-thread computation
    const { getBestMove } = await import("@/engine/ai/expectimax");
    return getBestMove(state, config);
  }
}

/**
 * Create an async AI player
 */
export function createAsyncAIPlayer(
  difficulty: DifficultyLevel = "medium",
): AsyncAIPlayer {
  return new AsyncAIPlayer(difficulty);
}

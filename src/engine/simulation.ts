/**
 * Mass Simulation Engine
 *
 * Runs multiple games in parallel and tracks results.
 *
 * Performance optimizations for iOS:
 * - Platform-aware concurrency and batch sizes
 * - Adaptive yielding to main thread
 * - Configurable performance parameters
 */

import { getAIMove } from "./ai";
import { applyMove, rollDie } from "./moves";
import { calculateGridScore } from "./scorer";
import { createInitialState } from "./state";
import type { DifficultyLevel, GameState, Player } from "./types";

/** Simulation performance configuration */
interface SimulationPerformanceConfig {
  /** Yield interval for UI responsiveness (moves between yields) */
  yieldInterval: number;
  /** Delay between batches in ms */
  batchDelay: number;
  /** Maximum concurrent games */
  maxConcurrency: number;
}

/** Default performance configuration */
let performanceConfig: SimulationPerformanceConfig = {
  yieldInterval: 3,
  batchDelay: 0,
  maxConcurrency: 10,
};

/**
 * Configure simulation performance based on platform
 * Call this on app initialization
 */
export function configureSimulationPerformance(
  config: Partial<SimulationPerformanceConfig>,
): void {
  performanceConfig = { ...performanceConfig, ...config };
}

/**
 * Get current simulation performance config
 */
export function getSimulationPerformanceConfig(): SimulationPerformanceConfig {
  return { ...performanceConfig };
}

export interface SimulationResult {
  id: number;
  winner: Player | "draw";
  finalScore: { player1: number; player2: number };
  turnCount: number;
  moves: Array<{
    turn: number;
    player: Player;
    dieValue: number;
    column: number;
    state: GameState;
  }>;
  finalState: GameState; // Final state after all moves
  player1Strategy: DifficultyLevel;
  player2Strategy: DifficultyLevel;
  completedAt: number;
}

export interface SimulationStats {
  totalGames: number;
  completedGames: number;
  player1Wins: number;
  player2Wins: number;
  draws: number;
  player1WinRate: number;
  player2WinRate: number;
  averageTurnCount: number;
  averageScoreDiff: number;
}

export interface SimulationConfig {
  player1Strategy: DifficultyLevel;
  player2Strategy: DifficultyLevel;
  numGames: number;
  onProgress?: (
    stats: SimulationStats,
    latestResult?: SimulationResult,
  ) => void;
  onGameComplete?: (result: SimulationResult) => void;
  controller?: SimulationController;
}

/**
 * Simulate a single game between two AI players
 * Uses platform-aware yielding for better iOS responsiveness
 */
async function simulateSingleGame(
  id: number,
  player1Strategy: DifficultyLevel,
  player2Strategy: DifficultyLevel,
): Promise<SimulationResult> {
  let state = createInitialState();
  const moves: SimulationResult["moves"] = [];
  let turnCount = 0;
  let moveCount = 0;

  // Get platform-aware yield interval
  const isHardDifficulty =
    player1Strategy === "hard" ||
    player1Strategy === "expert" ||
    player2Strategy === "hard" ||
    player2Strategy === "expert";

  // Use configured yield interval, with adjustment for difficulty
  const baseYieldInterval = performanceConfig.yieldInterval;
  const yieldInterval = isHardDifficulty
    ? Math.max(1, Math.floor(baseYieldInterval / 2))
    : baseYieldInterval;

  // Run the game until completion
  while (state.phase !== "ended") {
    // Roll die
    if (state.phase === "rolling") {
      state = rollDie(state);
    }

    // Get AI move
    const currentStrategy =
      state.currentPlayer === "player1" ? player1Strategy : player2Strategy;
    const move = getAIMove(state, currentStrategy);

    if (move === null) {
      // No legal moves - should not happen, but handle gracefully
      break;
    }

    // Record move before applying
    moves.push({
      turn: state.turnNumber,
      player: state.currentPlayer,
      dieValue: state.currentDie!,
      column: move,
      state: JSON.parse(JSON.stringify(state)) as GameState, // Deep clone
    });

    // Apply move
    const result = applyMove(state, move);
    if (!result) {
      break;
    }

    state = result.newState;
    turnCount = state.turnNumber;
    moveCount++;

    // Yield control to UI thread periodically to prevent blocking
    if (moveCount % yieldInterval === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  const scores = {
    player1: calculateGridScore(state.grids.player1).total,
    player2: calculateGridScore(state.grids.player2).total,
  };

  return {
    id,
    winner: state.winner || "draw",
    finalScore: scores,
    turnCount,
    moves,
    finalState: JSON.parse(JSON.stringify(state)) as GameState, // Deep clone final state
    player1Strategy,
    player2Strategy,
    completedAt: Date.now(),
  };
}

/**
 * Calculate statistics from results
 */
function calculateStats(
  results: SimulationResult[],
  totalGames: number,
): SimulationStats {
  const completedGames = results.length;
  const player1Wins = results.filter((r) => r.winner === "player1").length;
  const player2Wins = results.filter((r) => r.winner === "player2").length;
  const draws = results.filter((r) => r.winner === "draw").length;

  const player1WinRate = completedGames > 0 ? player1Wins / completedGames : 0;
  const player2WinRate = completedGames > 0 ? player2Wins / completedGames : 0;

  const averageTurnCount =
    completedGames > 0
      ? results.reduce((sum, r) => sum + r.turnCount, 0) / completedGames
      : 0;

  const averageScoreDiff =
    completedGames > 0
      ? results.reduce(
          (sum, r) => sum + (r.finalScore.player1 - r.finalScore.player2),
          0,
        ) / completedGames
      : 0;

  return {
    totalGames,
    completedGames,
    player1Wins,
    player2Wins,
    draws,
    player1WinRate,
    player2WinRate,
    averageTurnCount,
    averageScoreDiff,
  };
}

/**
 * Determine appropriate concurrency based on difficulty levels
 * Uses platform-aware maximum concurrency
 */
function getConcurrency(
  player1Strategy: DifficultyLevel,
  player2Strategy: DifficultyLevel,
): number {
  const isExpert = (strategy: DifficultyLevel) => strategy === "expert";
  const isHard = (strategy: DifficultyLevel) => strategy === "hard";

  // Get platform-configured max concurrency
  const maxConcurrency = performanceConfig.maxConcurrency;

  // Expert difficulty is extremely computationally intensive - run sequentially
  if (isExpert(player1Strategy) || isExpert(player2Strategy)) {
    return 1;
  }

  // Hard difficulty still needs reduced concurrency
  if (isHard(player1Strategy) || isHard(player2Strategy)) {
    return Math.min(2, maxConcurrency);
  }

  // For medium and below, use configured concurrency
  return maxConcurrency;
}

/**
 * Run mass simulation with configurable concurrency
 */
export async function runSimulation(
  config: SimulationConfig,
): Promise<SimulationResult[]> {
  const {
    numGames,
    player1Strategy,
    player2Strategy,
    onProgress,
    onGameComplete,
  } = config;
  const results: SimulationResult[] = [];
  const concurrency = getConcurrency(player1Strategy, player2Strategy);
  let nextId = 0;
  let cancelled = false;

  // Check for cancellation function
  const checkCancelled = () => {
    if (config.controller?.isCancelled()) {
      cancelled = true;
      return true;
    }
    return cancelled;
  };

  // Process games in batches
  for (let i = 0; i < numGames; i += concurrency) {
    if (checkCancelled()) break;

    const batchSize = Math.min(concurrency, numGames - i);
    const batch: Promise<SimulationResult>[] = [];

    // Start batch of games
    for (let j = 0; j < batchSize; j++) {
      if (checkCancelled()) break;
      const gameId = nextId++;
      batch.push(simulateSingleGame(gameId, player1Strategy, player2Strategy));
    }

    // Wait for batch to complete and process results
    // Use Promise.allSettled to handle any potential errors gracefully
    const batchResults = await Promise.allSettled(batch);

    for (const result of batchResults) {
      if (checkCancelled()) break;

      if (result.status === "fulfilled") {
        results.push(result.value);

        // Call onGameComplete callback
        onGameComplete?.(result.value);

        // Update stats and call progress callback
        const stats = calculateStats(results, numGames);
        onProgress?.(stats, result.value);
      } else {
        console.error("Simulation game failed:", result.reason);
      }
    }

    // Yield control to UI thread between batches
    // Use configured batch delay with adjustment for difficulty
    const isHardDifficulty =
      player1Strategy === "hard" ||
      player1Strategy === "expert" ||
      player2Strategy === "hard" ||
      player2Strategy === "expert";

    // Add extra delay for hard difficulties to prevent UI freezing
    const baseDelay = performanceConfig.batchDelay;
    const delay = isHardDifficulty ? Math.max(baseDelay, 10) : baseDelay;

    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  return results;
}

/**
 * Cancel a running simulation
 */
export class SimulationController {
  private cancelled = false;

  cancel(): void {
    this.cancelled = true;
  }

  isCancelled(): boolean {
    return this.cancelled;
  }
}

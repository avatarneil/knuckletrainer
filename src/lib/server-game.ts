/**
 * Server-side Game Computation Utilities
 * 
 * Provides functions to offload game computation to the server
 */

import type {
  DifficultyLevel,
  GameState,
  ColumnIndex,
  Player,
} from "@/engine/types";

export interface AIMoveResponse {
  success: boolean;
  state?: GameState;
  move?: ColumnIndex | null;
  phase?: string;
  error?: string;
}

export interface SimulateResponse {
  success: boolean;
  result?: {
    winner: Player | "draw";
    finalScore: { player1: number; player2: number };
    turnCount: number;
    moves: Array<{
      turn: number;
      player: Player;
      dieValue: number;
      column: number;
    }>;
  };
  error?: string;
}

export interface SimulateBatchResponse {
  success: boolean;
  results?: Array<{
    id: number;
    winner: Player | "draw";
    finalScore: { player1: number; player2: number };
    turnCount: number;
    moves: Array<{
      turn: number;
      player: Player;
      dieValue: number;
      column: number;
      state?: GameState; // Optional state for replay
    }>;
    finalState?: GameState; // Optional final state
  }>;
  stats?: {
    total: number;
    player1Wins: number;
    player2Wins: number;
    draws: number;
    player1WinRate: number;
    player2WinRate: number;
    averageTurnCount: number;
    averageScoreDiff: number;
  };
  error?: string;
}

/**
 * Compute an AI move on the server
 */
export async function computeAIMoveServer(
  state: GameState,
  difficulty: DifficultyLevel,
  rollFirst = false,
): Promise<AIMoveResponse> {
  try {
    const response = await fetch("/api/game/ai-move", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        state,
        difficulty,
        rollFirst,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error || "Failed to compute AI move",
      };
    }

    return await response.json();
  } catch (error) {
    console.error("Error calling AI move API:", error);
    return {
      success: false,
      error: "Network error",
    };
  }
}

/**
 * Simulate a single game on the server
 */
export async function simulateGameServer(
  player1Strategy: DifficultyLevel,
  player2Strategy: DifficultyLevel,
  initialState?: GameState,
): Promise<SimulateResponse> {
  try {
    const response = await fetch("/api/game/simulate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        player1Strategy,
        player2Strategy,
        initialState,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error || "Failed to simulate game",
      };
    }

    return await response.json();
  } catch (error) {
    console.error("Error calling simulate API:", error);
    return {
      success: false,
      error: "Network error",
    };
  }
}

/**
 * Simulate multiple games on the server (non-streaming)
 */
export async function simulateBatchServer(
  player1Strategy: DifficultyLevel,
  player2Strategy: DifficultyLevel,
  numGames: number,
  concurrency?: number,
): Promise<SimulateBatchResponse> {
  try {
    const response = await fetch("/api/game/simulate-batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        player1Strategy,
        player2Strategy,
        numGames,
        concurrency,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error || "Failed to simulate games",
      };
    }

    return await response.json();
  } catch (error) {
    console.error("Error calling simulate-batch API:", error);
    return {
      success: false,
      error: "Network error",
    };
  }
}

/**
 * Simulate multiple games on the server (streaming)
 * Returns an async generator that yields results as they complete
 */
export async function* simulateBatchStreamServer(
  player1Strategy: DifficultyLevel,
  player2Strategy: DifficultyLevel,
  numGames: number,
  concurrency?: number,
): AsyncGenerator<
  | { type: "result"; data: NonNullable<SimulateBatchResponse["results"]>[0] }
  | { type: "progress"; completed: number; total: number }
  | { type: "complete"; total: number; player1Wins: number; player2Wins: number; draws: number },
  void,
  unknown
> {
  try {
    const response = await fetch("/api/game/simulate-batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        player1Strategy,
        player2Strategy,
        numGames,
        concurrency,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to simulate games");
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            yield data;
          } catch (e) {
            console.error("Error parsing stream data:", e);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error in streaming simulation:", error);
    throw error;
  }
}

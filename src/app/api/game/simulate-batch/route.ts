/**
 * POST /api/game/simulate-batch
 *
 * Simulates multiple games between two AI players server-side.
 * Returns results progressively via streaming or all at once.
 */

import { NextResponse } from "next/server";
import { getAIMove, applyMove, rollDie, calculateGridScore } from "@/engine";
import { createInitialState } from "@/engine/state";
import type { DifficultyLevel, GameState, Player } from "@/engine/types";

interface SimulateBatchRequest {
  player1Strategy: DifficultyLevel;
  player2Strategy: DifficultyLevel;
  numGames: number;
  concurrency?: number; // Number of games to run in parallel (default: auto)
  stream?: boolean; // Whether to stream results (default: false)
  includeStates?: boolean; // Whether to include game states in moves (default: true)
}

interface GameResult {
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
}

/**
 * Simulate a single game
 */
async function simulateSingleGame(
  id: number,
  player1Strategy: DifficultyLevel,
  player2Strategy: DifficultyLevel,
  includeStates = true,
): Promise<GameResult> {
  let state = createInitialState();
  const moves: GameResult["moves"] = [];
  let turnCount = 0;
  const maxTurns = 100; // Safety limit

  while (state.phase !== "ended" && turnCount < maxTurns) {
    if (state.phase === "rolling") {
      state = rollDie(state);
    }

    const currentStrategy =
      state.currentPlayer === "player1" ? player1Strategy : player2Strategy;
    const move = getAIMove(state, currentStrategy);

    if (move === null) {
      break;
    }

    // Record move with state before applying (for replay)
    moves.push({
      turn: state.turnNumber,
      player: state.currentPlayer,
      dieValue: state.currentDie!,
      column: move,
      ...(includeStates && {
        state: JSON.parse(JSON.stringify(state)) as GameState, // Deep clone
      }),
    });

    const result = applyMove(state, move);
    if (!result) {
      break;
    }

    state = result.newState;
    turnCount = state.turnNumber;
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
    ...(includeStates && {
      finalState: JSON.parse(JSON.stringify(state)) as GameState, // Deep clone
    }),
  };
}

/**
 * Determine appropriate concurrency based on difficulty levels
 */
function getConcurrency(
  player1Strategy: DifficultyLevel,
  player2Strategy: DifficultyLevel,
): number {
  const isExpert = (strategy: DifficultyLevel) => strategy === "expert";
  const isHard = (strategy: DifficultyLevel) => strategy === "hard";

  if (isExpert(player1Strategy) || isExpert(player2Strategy)) {
    return 1;
  }

  if (isHard(player1Strategy) || isHard(player2Strategy)) {
    return 2;
  }

  return 10;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SimulateBatchRequest;
    const {
      player1Strategy,
      player2Strategy,
      numGames,
      concurrency: requestedConcurrency,
      stream = false,
      includeStates = true,
    } = body;

    if (numGames <= 0 || numGames > 10000) {
      return NextResponse.json(
        { success: false, error: "Invalid number of games (1-10000)" },
        { status: 400 },
      );
    }

    const concurrency =
      requestedConcurrency ?? getConcurrency(player1Strategy, player2Strategy);

    // If streaming, use ReadableStream
    if (stream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const results: GameResult[] = [];
          let nextId = 0;

          try {
            // Process games in batches
            for (let i = 0; i < numGames; i += concurrency) {
              const batchSize = Math.min(concurrency, numGames - i);
              const batch: Promise<GameResult>[] = [];

              // Start batch
              for (let j = 0; j < batchSize; j++) {
                const gameId = nextId++;
                batch.push(
                  simulateSingleGame(
                    gameId,
                    player1Strategy,
                    player2Strategy,
                    includeStates,
                  ),
                );
              }

              // Wait for batch and stream results
              const batchResults = await Promise.allSettled(batch);
              for (const result of batchResults) {
                if (result.status === "fulfilled") {
                  results.push(result.value);
                  // Stream individual result
                  const data = JSON.stringify({
                    type: "result",
                    data: result.value,
                  });
                  controller.enqueue(encoder.encode(data + "\n"));
                }
              }

              // Stream progress update
              const progress = {
                type: "progress",
                completed: results.length,
                total: numGames,
              };
              controller.enqueue(encoder.encode(JSON.stringify(progress) + "\n"));
            }

            // Stream final summary
            const summary = {
              type: "complete",
              total: results.length,
              player1Wins: results.filter((r) => r.winner === "player1").length,
              player2Wins: results.filter((r) => r.winner === "player2").length,
              draws: results.filter((r) => r.winner === "draw").length,
            };
            controller.enqueue(encoder.encode(JSON.stringify(summary) + "\n"));
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Non-streaming: return all results at once
    const results: GameResult[] = [];
    let nextId = 0;

    // Process games in batches
    for (let i = 0; i < numGames; i += concurrency) {
      const batchSize = Math.min(concurrency, numGames - i);
      const batch: Promise<GameResult>[] = [];

              // Start batch
              for (let j = 0; j < batchSize; j++) {
                const gameId = nextId++;
                batch.push(
                  simulateSingleGame(
                    gameId,
                    player1Strategy,
                    player2Strategy,
                    includeStates,
                  ),
                );
              }

      // Wait for batch
      const batchResults = await Promise.allSettled(batch);
      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          results.push(result.value);
        }
      }
    }

    // Calculate statistics
    const player1Wins = results.filter((r) => r.winner === "player1").length;
    const player2Wins = results.filter((r) => r.winner === "player2").length;
    const draws = results.filter((r) => r.winner === "draw").length;

    return NextResponse.json({
      success: true,
      results,
      stats: {
        total: results.length,
        player1Wins,
        player2Wins,
        draws,
        player1WinRate: results.length > 0 ? player1Wins / results.length : 0,
        player2WinRate: results.length > 0 ? player2Wins / results.length : 0,
        averageTurnCount:
          results.length > 0
            ? results.reduce((sum, r) => sum + r.turnCount, 0) / results.length
            : 0,
        averageScoreDiff:
          results.length > 0
            ? results.reduce(
                (sum, r) => sum + (r.finalScore.player1 - r.finalScore.player2),
                0,
              ) / results.length
            : 0,
      },
    });
  } catch (error) {
    console.error("Error simulating batch:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to simulate games",
      },
      { status: 500 },
    );
  }
}

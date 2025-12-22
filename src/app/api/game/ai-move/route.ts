/**
 * POST /api/game/ai-move
 *
 * Computes an AI move for the given game state.
 */

import { NextResponse } from "next/server";
import { getAIMove, rollDie } from "@/engine";
import type { DifficultyLevel, GameState } from "@/engine/types";

interface AIMoveRequest {
  state: GameState;
  difficulty: DifficultyLevel;
  rollFirst?: boolean; // If true, roll die first before computing move
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AIMoveRequest;
    const { state, difficulty, rollFirst = false } = body;

    // Validate state
    if (!state || !state.grids || !state.currentPlayer) {
      return NextResponse.json(
        { success: false, error: "Invalid game state" },
        { status: 400 },
      );
    }

    // If game is ended, return error
    if (state.phase === "ended") {
      return NextResponse.json(
        { success: false, error: "Game has ended" },
        { status: 400 },
      );
    }

    let currentState = state;

    // Roll die if needed
    if (rollFirst && currentState.phase === "rolling") {
      currentState = rollDie(currentState);
    }

    // If still in rolling phase after roll, return the rolled state
    if (currentState.phase === "rolling") {
      return NextResponse.json({
        success: true,
        state: currentState,
        move: null,
        phase: "rolling",
      });
    }

    // Compute AI move
    const move = getAIMove(currentState, difficulty);

    if (move === null) {
      return NextResponse.json(
        { success: false, error: "No legal moves available" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      state: currentState,
      move,
      phase: currentState.phase,
    });
  } catch (error) {
    console.error("Error computing AI move:", error);
    return NextResponse.json(
      { success: false, error: "Failed to compute AI move" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/rooms/create-ai
 *
 * Creates a new public AI match room.
 */

import { NextResponse } from "next/server";
import { createInitialState } from "@/engine";
import { generateRoomCode, getRoom, setRoom } from "@/lib/kv";
import type { GameRoom } from "@/lib/kv";

interface CreateAIRoomRequest {
  playerName: string;
  difficulty: string;
  initialState?: any; // GameState
  followedBy?: string[]; // Array of watcher tokens to migrate from previous match
  previousRoomId?: string | null;
}

function uniqueTokens(tokens: string[]): string[] {
  return [...new Set(tokens.filter(Boolean))];
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateAIRoomRequest;
    const playerName = body.playerName?.trim() || "Player";
    const difficulty = body.difficulty || "medium";
    const previousRoomId = body.previousRoomId?.trim() || null;

    // Generate room code
    const roomId = generateRoomCode();

    const previousRoom = previousRoomId ? await getRoom(previousRoomId) : null;
    const inheritedFollowers =
      previousRoom?.isPublic === true
        ? uniqueTokens([...(previousRoom.followedBy ?? []), ...(body.followedBy ?? [])])
        : uniqueTokens(body.followedBy ?? []);

    // Create the room (AI matches are always public)
    const room: GameRoom = {
      createdAt: Date.now(),
      followedBy: inheritedFollowers,
      gameType: "ai",
      id: roomId,
      isPublic: true,
      lastActivity: Date.now(),
      player1: {
        token: "", // No token needed for AI matches
        name: playerName,
      },
      player2: {
        token: "",
        name: `${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} AI`,
      },
      previousRoomId: previousRoom?.isPublic === true ? previousRoom.id : null,
      rematchRequested: null,
      state: body.initialState || createInitialState(),
      successorRoomId: null,
      watchers: [],
    };

    // Save room
    await setRoom(room);

    if (previousRoom?.isPublic === true) {
      previousRoom.successorRoomId = roomId;
      previousRoom.followedBy = inheritedFollowers;
      await setRoom(previousRoom);
    }

    return NextResponse.json({
      roomId,
      followerCount: inheritedFollowers.length,
      success: true,
    });
  } catch (error) {
    console.error("Error creating AI room:", error);
    return NextResponse.json(
      { error: "Failed to create AI room", success: false },
      { status: 500 }
    );
  }
}

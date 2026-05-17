"use client";

import {
  ArrowLeft,
  ArrowRight,
  Eye,
  GraduationCap,
  Heart,
  Loader2,
  Star,
  Wifi,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameBoard } from "@/components/game";
import { InstallPrompt } from "@/components/pwa";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import type { GameState } from "@/engine/types";
import { useOnlineStatus } from "@/hooks/usePWA";
import { getApiBaseUrl } from "@/lib/api";
import {
  buildSpectatorCoachAnalysis,
  explainLatestSpectatorMove,
  getSpectatorAnalysisKey,
  type SpectatorCoachAnalysis,
  type SpectatorMoveExplanation,
} from "@/lib/spectator-coach";
import {
  getSpectatorToken,
  setSpectatorMatchFollowed,
  upsertSpectatorMatchRecord,
} from "@/lib/spectator";

interface RoomState {
  roomId: string;
  state: GameState;
  player1: { name: string } | null;
  player2: { name: string } | null;
  gameType: "multiplayer" | "ai";
  watcherCount: number;
  followerCount: number;
  isFollowedByCurrentWatcher: boolean;
  successorRoomId: string | null;
}

function formatProbability(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function SpectatorCoachPanel({
  analysis,
  coachEnabled,
  lastMoveExplanation,
  phase,
}: {
  analysis: SpectatorCoachAnalysis | null;
  coachEnabled: boolean;
  lastMoveExplanation: SpectatorMoveExplanation | null;
  phase: GameState["phase"];
}) {
  if (!coachEnabled) {
    return null;
  }

  return (
    <section className="shrink-0 rounded-lg border border-border/70 bg-card/85 px-3 py-2 shadow-sm">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <GraduationCap className="h-4 w-4 text-accent" />
            Spectator Coach
            {analysis?.bestMove !== null && analysis?.bestMove !== undefined && (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">
                Best: column {analysis.bestMove + 1}
              </span>
            )}
          </div>
          {lastMoveExplanation && (
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{lastMoveExplanation.title}: </span>
              {lastMoveExplanation.detail}
            </p>
          )}
        </div>

        {phase !== "placing" && (
          <p className="text-xs text-muted-foreground lg:text-right">
            Waiting for the next placement.
          </p>
        )}

        {analysis && analysis.moves.length > 0 && (
          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-3 lg:max-w-3xl">
            {analysis.moves.map((move) => (
              <div
                key={move.column}
                className={`rounded-md border px-2 py-1.5 text-xs ${
                  move.isBest ? "border-accent bg-accent/10" : "border-border/60 bg-background/60"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">Column {move.column + 1}</span>
                  <span className="flex items-center gap-1 font-medium text-accent">
                    {move.isBest && <Star className="h-3.5 w-3.5 fill-current" />}
                    {formatProbability(move.winProbability)}
                  </span>
                </div>
                <p className="mt-1 text-muted-foreground">{move.explanation}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function WatchRoomPage() {
  const params = useParams();
  const roomId = params.id as string;
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [coachEnabled, setCoachEnabled] = useState(false);
  const [watcherToken, setWatcherToken] = useState<string | null>(null);
  const [lastMoveExplanation, setLastMoveExplanation] = useState<SpectatorMoveExplanation | null>(
    null
  );
  const previousStateRef = useRef<GameState | null>(null);
  const analysisCacheRef = useRef<Map<string, SpectatorCoachAnalysis>>(new Map());
  const isOnline = useOnlineStatus();

  // Get or create watcher token
  useEffect(() => {
    setWatcherToken(getSpectatorToken());
  }, []);

  const fetchRoomState = useCallback(async () => {
    if (!isOnline || !roomId) {
      setError("Requires internet connection");
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const response = await fetch(`${getApiBaseUrl()}/api/rooms/${roomId}/state`, {
        headers: watcherToken ? { "x-watcher-token": watcherToken } : undefined,
      });
      const data = await response.json();

      if (data.success) {
        const nextState = data.state as GameState;
        const player1Name = data.player1?.name ?? "Player 1";
        const player2Name = data.player2?.name ?? "Player 2";
        const explanation = previousStateRef.current
          ? explainLatestSpectatorMove(previousStateRef.current, nextState, {
              player1: player1Name,
              player2: player2Name,
            })
          : null;

        if (explanation) {
          setLastMoveExplanation(explanation);
        }
        previousStateRef.current = nextState;

        setRoomState({
          gameType: data.gameType,
          followerCount: data.followerCount ?? 0,
          isFollowedByCurrentWatcher: data.isFollowedByCurrentWatcher ?? false,
          player1: data.player1,
          player2: data.player2,
          roomId: data.roomId,
          state: nextState,
          successorRoomId: data.successorRoomId ?? null,
          watcherCount: data.watcherCount ?? 0,
        });

        const localFollowing =
          typeof window !== "undefined" && localStorage.getItem(`following_${roomId}`) === "true";
        const following = localFollowing || data.isFollowedByCurrentWatcher === true;
        setIsFollowing(following);

        upsertSpectatorMatchRecord({
          followed: following,
          gameType: data.gameType,
          player1Name,
          player2Name,
          roomId: data.roomId,
          successorRoomId: data.successorRoomId ?? null,
        });
      } else {
        setError(data.error || "Room not found");
      }
    } catch (error) {
      console.error("Error fetching room state:", error);
      setError("Failed to load room");
    } finally {
      setLoading(false);
    }
  }, [isOnline, roomId, watcherToken]);

  const handleFollow = async () => {
    if (!watcherToken || !roomId) {
      return;
    }

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/rooms/${roomId}/follow`, {
        body: JSON.stringify({
          action: isFollowing ? "unfollow" : "follow",
          watcherToken,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      const data = await response.json();
      if (data.success) {
        const nextFollowing = data.isFollowing ?? !isFollowing;
        setIsFollowing(nextFollowing);
        if (typeof window !== "undefined") {
          localStorage.setItem(`following_${roomId}`, nextFollowing.toString());
        }
        setSpectatorMatchFollowed(roomId, nextFollowing);
        if (roomState) {
          upsertSpectatorMatchRecord({
            followed: nextFollowing,
            gameType: roomState.gameType,
            player1Name: roomState.player1?.name ?? "Player 1",
            player2Name: roomState.player2?.name ?? "Player 2",
            roomId,
            successorRoomId: roomState.successorRoomId,
          });
        }
      }
    } catch (error) {
      console.error("Error following room:", error);
    }
  };

  useEffect(() => {
    fetchRoomState();
    // Poll every second for updates
    const interval = setInterval(fetchRoomState, 1000);
    return () => clearInterval(interval);
  }, [fetchRoomState]);

  const coachAnalysis = useMemo(() => {
    if (!coachEnabled || !roomState || roomState.state.phase !== "placing") {
      return null;
    }

    const key = getSpectatorAnalysisKey(roomState.state);
    const cached = analysisCacheRef.current.get(key);
    if (cached) {
      return cached;
    }

    const nextAnalysis = buildSpectatorCoachAnalysis(roomState.state);
    analysisCacheRef.current.set(key, nextAnalysis);
    if (analysisCacheRef.current.size > 20) {
      const oldestKey = analysisCacheRef.current.keys().next().value;
      if (oldestKey) {
        analysisCacheRef.current.delete(oldestKey);
      }
    }
    return nextAnalysis;
  }, [coachEnabled, roomState]);

  if (loading) {
    return (
      <main className="h-[100dvh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading match...</p>
        </div>
      </main>
    );
  }

  if (error || !roomState) {
    return (
      <main className="h-[100dvh] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <p className="text-destructive mb-4">{error || "Room not found"}</p>
          <Link href="/watch">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Watch List
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      className="h-[100dvh] flex flex-col p-2 sm:p-4 md:p-6 overflow-hidden"
      style={{
        paddingTop: "max(1rem, calc(env(safe-area-inset-top) + 0.5rem))",
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
      }}
    >
      <InstallPrompt />
      {/* Header */}
      <header className="flex items-center justify-between mb-2 sm:mb-4 flex-shrink-0">
        <Link href="/watch">
          <Button variant="ghost" size="sm" className="px-2 sm:px-3">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline ml-2">Back</span>
          </Button>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <ThemeSwitcher />
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/70 px-2 py-1">
            <GraduationCap className="h-4 w-4 text-accent" />
            <Label htmlFor="spectator-coach" className="hidden cursor-pointer text-xs sm:inline">
              Coach
            </Label>
            <Switch id="spectator-coach" checked={coachEnabled} onCheckedChange={setCoachEnabled} />
          </div>
          <Button
            variant={isFollowing ? "default" : "outline"}
            size="sm"
            onClick={handleFollow}
            className="flex items-center gap-1"
          >
            <Heart className={`w-4 h-4 ${isFollowing ? "fill-current" : ""}`} />
            <span className="hidden sm:inline">{isFollowing ? "Following" : "Follow"}</span>
          </Button>
          {roomState.followerCount > 0 && (
            <div className="hidden text-xs text-muted-foreground sm:block">
              {roomState.followerCount} following
            </div>
          )}
          <div className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
            <Eye className="w-4 h-4" />
            <span>{roomState.watcherCount} watching</span>
          </div>
          <div className="text-xs sm:text-sm text-muted-foreground">
            <span className="hidden sm:inline">Room: </span>
            <span className="font-mono text-accent">{roomState.roomId}</span>
          </div>
          {isOnline ? (
            <Wifi className="w-4 h-4 text-green-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-500" />
          )}
        </div>
      </header>

      {/* Turn indicator */}
      <div className="text-center mb-1 sm:mb-2 flex-shrink-0">
        <span className="text-sm sm:text-lg font-medium text-muted-foreground">
          {roomState.state.phase === "ended"
            ? "Game Over"
            : roomState.state.phase === "rolling"
              ? "Rolling dice..."
              : "Placing die..."}
        </span>
      </div>

      {isFollowing && roomState.state.phase === "ended" && (
        <div className="mb-2 shrink-0 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <span className="font-semibold text-accent">Following this match.</span>{" "}
              <span className="text-muted-foreground">
                {roomState.successorRoomId
                  ? "A successor public room is available."
                  : "Waiting for the next public room in this sequence."}
              </span>
            </div>
            {roomState.successorRoomId && (
              <Link href={`/watch/${roomState.successorRoomId}`}>
                <Button size="sm">
                  Continue Watching
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Game Board */}
      <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-hidden">
        <GameBoard
          state={roomState.state}
          isRolling={roomState.state.phase === "rolling"}
          onRoll={() => {}} // Watchers can't interact
          onColumnClick={() => {}} // Watchers can't interact
          player1Name={roomState.player1?.name ?? "Player 1"}
          player2Name={roomState.player2?.name ?? "Player 2"}
          isPlayer1Human={false}
          isPlayer2Human={false}
          moveAnalysis={coachAnalysis?.moves}
          showProbabilities={coachEnabled && roomState.state.phase === "placing"}
          highlightedColumn={coachAnalysis?.bestMove}
        />
        <SpectatorCoachPanel
          analysis={coachAnalysis}
          coachEnabled={coachEnabled}
          lastMoveExplanation={lastMoveExplanation}
          phase={roomState.state.phase}
        />
      </div>
    </main>
  );
}

"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  History,
  Lightbulb,
  ListRestart,
  Play,
  RotateCcw,
  Settings,
  Trash2,
  Trophy,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { GameBoard, KeyboardShortcuts } from "@/components/game";
import { InstallPrompt } from "@/components/pwa";
import { WinProbability } from "@/components/training";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  DIFFICULTY_CONFIGS,
  applyMove,
  buildPostGameCoachBrief,
  createInitialState,
  type PostGameCoachBrief,
  type PostGameCoachMoment,
} from "@/engine";
import { isColumnFull } from "@/engine/scorer";
import type { ColumnIndex, DifficultyLevel, GameState } from "@/engine/types";
import { ALL_COLUMNS } from "@/engine/types";
import { useGame } from "@/hooks/useGame";
import { useGameHistory } from "@/hooks/useGameHistory";
import { useKeyboardControls } from "@/hooks/useKeyboardControls";
import { getApiBaseUrl } from "@/lib/api";
import { gameStorage } from "@/lib/game-storage";

type CoachReviewState = {
  mode: "inspect" | "retry";
  moment: PostGameCoachMoment;
  selectedColumn: ColumnIndex | null;
};

function formatColumn(column: ColumnIndex): string {
  return `Column ${column + 1}`;
}

function formatWinProbability(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatWinDelta(value: number): string {
  return `${Math.round(value * 100)} pts`;
}

function PlayContent() {
  const searchParams = useSearchParams();
  const initialDifficulty = (searchParams.get("difficulty") as DifficultyLevel) || "medium";
  const initialTraining = searchParams.get("training") === "true";

  const [showSettings, setShowSettings] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [showClearHistoryDialog, setShowClearHistoryDialog] = useState(false);
  const [pendingSavedSession, setPendingSavedSession] =
    useState<ReturnType<typeof gameStorage.loadSession>>(null);
  const [lastWinner, setLastWinner] = useState<"player1" | "player2" | "draw" | null>(null);
  const [isPublicMatch, setIsPublicMatch] = useState(false);
  const [coachBrief, setCoachBrief] = useState<PostGameCoachBrief | null>(null);
  const [coachReview, setCoachReview] = useState<CoachReviewState | null>(null);
  const publicRoomIdRef = useRef<string | null>(null);

  // Game history hook for persistence
  const gameHistory = useGameHistory();

  // Track current session ID
  const sessionIdRef = useRef<string | null>(null);
  const hasCheckedResume = useRef(false);
  // Track current state for callbacks
  const latestStateRef = useRef<GameState | null>(null);
  const latestSettingsRef = useRef({
    difficulty: initialDifficulty,
    trainingMode: initialTraining,
  });

  // Game state - may be initialized from saved session
  const [gameInitialState, setGameInitialState] = useState<GameState | undefined>(undefined);
  const [gameDifficulty, setGameDifficulty] = useState<DifficultyLevel>(initialDifficulty);
  const [gameTrainingMode, setGameTrainingMode] = useState(initialTraining);
  const [isReady, setIsReady] = useState(false);
  // Key to force remount of game hook when starting fresh or resuming
  const [_gameKey, setGameKey] = useState(0);

  // Get followers from previous room
  const getPreviousRoomFollowers = useCallback(async (): Promise<string[]> => {
    if (!publicRoomIdRef.current) {
      return [];
    }
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/rooms/${publicRoomIdRef.current}/state`);
      const data = await response.json();
      if (data.success && data.followedBy) {
        return data.followedBy;
      }
    } catch (error) {
      console.error("Error getting previous room followers:", error);
    }
    return [];
  }, []);

  // Create or update public room
  const updatePublicRoom = useCallback(
    async (state: GameState) => {
      if (!isPublicMatch) {
        return;
      }

      try {
        if (publicRoomIdRef.current) {
          // Update existing room
          await fetch(`${getApiBaseUrl()}/api/rooms/update-ai`, {
            body: JSON.stringify({
              roomId: publicRoomIdRef.current,
              state,
            }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          });
        } else {
          // Get followers from previous room if it exists
          const followedBy = await getPreviousRoomFollowers();

          // Create new room
          const response = await fetch(`${getApiBaseUrl()}/api/rooms/create-ai`, {
            body: JSON.stringify({
              playerName: "You",
              difficulty: gameDifficulty,
              initialState: state,
              followedBy, // Migrate followers
            }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          });
          const data = await response.json();
          if (data.success) {
            publicRoomIdRef.current = data.roomId;

            // Notify followers (in a real implementation, you'd use websockets or server-sent events)
            // For now, followers will need to poll or check the watch page
          }
        }
      } catch (error) {
        console.error("Error updating public room:", error);
      }
    },
    [isPublicMatch, gameDifficulty, getPreviousRoomFollowers]
  );

  const startNewSession = useCallback(async () => {
    const newState = createInitialState();
    setCoachBrief(null);
    setCoachReview(null);
    setLastWinner(null);
    const sessionId = gameHistory.startSession({
      difficulty: gameDifficulty,
      initialState: newState,
      mode: "ai",
      trainingMode: gameTrainingMode,
    });
    sessionIdRef.current = sessionId;
    latestStateRef.current = newState;

    // If public match is enabled, create a new room
    if (isPublicMatch) {
      publicRoomIdRef.current = null; // Reset to create new room
      await updatePublicRoom(newState);
    }

    setGameInitialState(newState);
    setGameKey((k) => k + 1); // Force remount of game hook
    setIsReady(true);
  }, [gameHistory, gameDifficulty, gameTrainingMode, isPublicMatch, updatePublicRoom]);

  // Check for saved game on mount - directly check storage to avoid race condition
  useEffect(() => {
    if (hasCheckedResume.current) {
      return;
    }
    hasCheckedResume.current = true;

    // Directly check storage instead of relying on state (which loads async)
    const saved = gameStorage.loadSession();
    if (saved && saved.state.phase !== "ended") {
      // There's a saved game - ask user if they want to resume
      setPendingSavedSession(saved);
      setShowResumeDialog(true);
    } else {
      // No saved game - start fresh
      startNewSession();
    }
  }, [startNewSession]);

  const handleResume = useCallback(() => {
    // Use the pending saved session
    if (pendingSavedSession) {
      sessionIdRef.current = pendingSavedSession.id;
      latestStateRef.current = pendingSavedSession.state;
      setGameInitialState(pendingSavedSession.state);
      setGameDifficulty(pendingSavedSession.difficulty);
      setGameTrainingMode(pendingSavedSession.trainingMode);
      setGameKey((k) => k + 1); // Force remount of game hook
    }
    setShowResumeDialog(false);
    setPendingSavedSession(null);
    setIsReady(true);
  }, [pendingSavedSession]);

  const handleDiscardAndNew = useCallback(() => {
    gameHistory.discardGame();
    setShowResumeDialog(false);
    setPendingSavedSession(null);
    startNewSession();
  }, [gameHistory, startNewSession]);

  const handleStateChange = useCallback(
    (state: GameState) => {
      // Track latest state for callbacks
      latestStateRef.current = state;
      // Auto-save on every state change
      if (sessionIdRef.current && state.phase !== "ended") {
        gameHistory.saveGame(sessionIdRef.current, state);
      }
      // Update public room if enabled
      updatePublicRoom(state);
    },
    [gameHistory, updatePublicRoom]
  );

  const handleGameEnd = useCallback(
    (winner: "player1" | "player2" | "draw", finalState: GameState) => {
      setLastWinner(winner);
      setShowGameOver(true);
      latestStateRef.current = finalState;
      setCoachReview(null);

      const settings = latestSettingsRef.current;
      const brief = buildPostGameCoachBrief(finalState, {
        difficulty: settings.difficulty,
        mode: "ai",
        trainingMode: settings.trainingMode,
      });
      setCoachBrief(brief);

      // Record to history using the latest state ref
      if (sessionIdRef.current) {
        gameHistory.recordGameEnd(sessionIdRef.current, finalState, winner, brief);
      }
    },
    [gameHistory]
  );

  const game = useGame({
    difficulty: gameDifficulty,
    initialState: gameInitialState,
    mode: "ai",
    onGameEnd: handleGameEnd,
    onStateChange: handleStateChange,
    trainingMode: gameTrainingMode,
  });

  useEffect(() => {
    latestSettingsRef.current = {
      difficulty: game.difficulty,
      trainingMode: game.isTrainingMode,
    };
  }, [game.difficulty, game.isTrainingMode]);

  const handleDifficultyChange = useCallback(
    (level: DifficultyLevel) => {
      setGameDifficulty(level);
      latestSettingsRef.current = {
        ...latestSettingsRef.current,
        difficulty: level,
      };
      game.setDifficulty(level);
    },
    [game]
  );

  const handleTrainingModeChange = useCallback(
    (trainingMode: boolean) => {
      setGameTrainingMode(trainingMode);
      latestSettingsRef.current = {
        ...latestSettingsRef.current,
        trainingMode,
      };
      if (trainingMode !== game.isTrainingMode) {
        game.toggleTrainingMode();
      }
    },
    [game]
  );

  // Calculate legal columns and game state for keyboard controls
  const isPlayer1Turn = game.state.currentPlayer === "player1";
  const isRollingPhase = game.state.phase === "rolling";
  const isPlacingPhase = game.state.phase === "placing";
  const isEnded = game.state.phase === "ended";
  const currentGrid = game.state.grids[game.state.currentPlayer];
  const legalColumns = ALL_COLUMNS.filter((i) => !isColumnFull(currentGrid[i]));
  const canRoll = isRollingPhase && isPlayer1Turn && !isEnded;
  const canPlace = isPlacingPhase && isPlayer1Turn && !isEnded;

  // Set up keyboard controls
  useKeyboardControls({
    canPlace,
    canRoll,
    enabled: isReady && !coachReview,
    gameState: game.state,
    legalColumns,
    onPlaceDie: game.placeDie,
    onRoll: game.roll,
  });

  const handleNewGame = useCallback(async () => {
    // Clear old session if it exists and wasn't recorded
    if (sessionIdRef.current) {
      gameHistory.discardGame();
    }

    // Reset game
    game.resetGame();
    setShowGameOver(false);
    setLastWinner(null);
    setCoachBrief(null);
    setCoachReview(null);

    // Start new session
    const newState = createInitialState();
    const sessionId = gameHistory.startSession({
      difficulty: game.difficulty,
      initialState: newState,
      mode: "ai",
      trainingMode: game.isTrainingMode,
    });
    sessionIdRef.current = sessionId;
    latestStateRef.current = newState;
    setGameDifficulty(game.difficulty);
    setGameTrainingMode(game.isTrainingMode);
    setGameInitialState(newState);

    // If public match is enabled, create a new room (followers will auto-join)
    if (isPublicMatch) {
      publicRoomIdRef.current = null; // Reset to create new room
      await updatePublicRoom(newState);
    }
  }, [game, gameHistory, isPublicMatch, updatePublicRoom]);

  const handleInspectCoachMoment = useCallback(() => {
    const moment = coachBrief?.moments[0];
    if (!moment) {
      return;
    }
    setCoachReview({ mode: "inspect", moment, selectedColumn: null });
    setShowGameOver(false);
  }, [coachBrief]);

  const handleRetryCoachMoment = useCallback(() => {
    const moment = coachBrief?.moments[0];
    if (!moment) {
      return;
    }
    setCoachReview({ mode: "retry", moment, selectedColumn: null });
    setShowGameOver(false);
  }, [coachBrief]);

  const handleRetryColumn = useCallback((column: ColumnIndex) => {
    setCoachReview((current) => {
      if (!current || current.mode !== "retry" || current.selectedColumn !== null) {
        return current;
      }

      const result = applyMove(current.moment.stateBeforeMove, column);
      if (!result) {
        return current;
      }

      return {
        ...current,
        selectedColumn: column,
      };
    });
  }, []);

  const handleExitCoachReview = useCallback(() => {
    setCoachReview(null);
  }, []);

  // Format time for display
  const formatTimeSince = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) {
      return "just now";
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours}h ago`;
    }
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // Show loading until we've checked for resume
  if (!isReady) {
    return (
      <main className="h-[100dvh] flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>

        {/* Resume Dialog */}
        <Dialog open={showResumeDialog} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-accent" />
                Resume Game?
              </DialogTitle>
              <DialogDescription>
                You have an unfinished game from{" "}
                {pendingSavedSession
                  ? formatTimeSince(pendingSavedSession.lastPlayedAt)
                  : "earlier"}
                . Would you like to continue where you left off?
              </DialogDescription>
            </DialogHeader>

            {pendingSavedSession && (
              <div className="py-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Difficulty:</span>
                  <span className="font-medium">
                    {DIFFICULTY_CONFIGS[pendingSavedSession.difficulty].name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Turn:</span>
                  <span className="font-medium">{pendingSavedSession.state.turnNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Training Mode:</span>
                  <span className="font-medium">
                    {pendingSavedSession.trainingMode ? "On" : "Off"}
                  </span>
                </div>
              </div>
            )}

            <DialogFooter className="flex gap-2 sm:gap-2">
              <Button variant="outline" onClick={handleDiscardAndNew} className="flex-1">
                <Trash2 className="mr-2 h-4 w-4" />
                New Game
              </Button>
              <Button onClick={handleResume} className="flex-1">
                <Play className="mr-2 h-4 w-4" />
                Resume
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    );
  }

  const primaryCoachMoment = coachBrief?.moments[0] ?? null;
  const isRetryAwaitingChoice =
    coachReview?.mode === "retry" && coachReview.selectedColumn === null;
  const retryMatchedRecommendation =
    coachReview?.selectedColumn != null &&
    coachReview.selectedColumn === coachReview.moment.recommendedColumn;
  const shouldRevealCoachRecommendation =
    coachReview?.mode === "inspect" || coachReview?.selectedColumn != null;
  const boardState = coachReview ? coachReview.moment.stateBeforeMove : game.state;
  const boardMoveAnalysis = coachReview
    ? shouldRevealCoachRecommendation
      ? coachReview.moment.analysis
      : undefined
    : (game.moveAnalysis ?? undefined);
  const boardHighlightedColumn =
    coachReview && shouldRevealCoachRecommendation
      ? coachReview.moment.recommendedColumn
      : undefined;

  return (
    <main
      className="h-[100dvh] flex flex-col p-[clamp(0.5rem,2vw,1.5rem)] overflow-hidden"
      style={{
        paddingTop: "max(1rem, calc(env(safe-area-inset-top) + 0.5rem))",
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
      }}
    >
      <InstallPrompt />
      {/* Header */}
      <header className="flex items-center justify-between mb-[clamp(0.5rem,1.5vw,1rem)] flex-shrink-0">
        <Link href="/">
          <Button variant="ghost" size="sm" className="px-[clamp(0.5rem,1.5vw,0.75rem)]">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden xs:inline ml-2">Back</span>
          </Button>
        </Link>

        <div className="flex items-center gap-[clamp(0.25rem,1vw,0.5rem)]">
          {/* Public Match Toggle - compact on mobile */}
          <div className="flex items-center gap-[clamp(0.25rem,1vw,0.5rem)] px-[clamp(0.5rem,1.5vw,0.75rem)] py-[clamp(0.25rem,0.75vw,0.375rem)] rounded-lg bg-card/50 border border-border/50">
            {isPublicMatch ? (
              <Eye className="w-[clamp(0.875rem,2.5vw,1rem)] h-[clamp(0.875rem,2.5vw,1rem)] text-accent" />
            ) : (
              <EyeOff className="w-[clamp(0.875rem,2.5vw,1rem)] h-[clamp(0.875rem,2.5vw,1rem)] text-muted-foreground" />
            )}
            <Label
              htmlFor="public-match-toggle"
              className="text-[clamp(0.75rem,2vw,0.875rem)] cursor-pointer hidden xs:inline"
            >
              Public
            </Label>
            <Switch
              id="public-match-toggle"
              checked={isPublicMatch}
              onCheckedChange={async (checked) => {
                setIsPublicMatch(checked);
                if (checked && latestStateRef.current) {
                  // Create room immediately when toggled on
                  await updatePublicRoom(latestStateRef.current);
                } else {
                  // Clear room reference when toggled off
                  publicRoomIdRef.current = null;
                }
              }}
            />
          </div>

          {/* Training Mode Toggle - compact on mobile */}
          <div className="flex items-center gap-[clamp(0.25rem,1vw,0.5rem)] px-[clamp(0.5rem,1.5vw,0.75rem)] py-[clamp(0.25rem,0.75vw,0.375rem)] rounded-lg bg-card/50 border border-border/50">
            <GraduationCap className="w-[clamp(0.875rem,2.5vw,1rem)] h-[clamp(0.875rem,2.5vw,1rem)] text-accent" />
            <Label
              htmlFor="training-toggle"
              className="text-[clamp(0.75rem,2vw,0.875rem)] cursor-pointer hidden xs:inline"
            >
              Training
            </Label>
            <Switch
              id="training-toggle"
              checked={game.isTrainingMode}
              onCheckedChange={handleTrainingModeChange}
            />
          </div>

          <ThemeSwitcher />

          <Button
            variant="ghost"
            size="icon"
            className="h-[clamp(2rem,5vw,2.25rem)] w-[clamp(2rem,5vw,2.25rem)]"
            onClick={() => setShowSettings(true)}
          >
            <Settings className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="px-[clamp(0.5rem,1.5vw,0.75rem)]"
            onClick={handleNewGame}
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden xs:inline ml-2">New Game</span>
          </Button>
        </div>
      </header>

      {/* Difficulty indicator */}
      <div className="text-center mb-[clamp(0.25rem,1vw,0.5rem)] flex-shrink-0">
        <span className="text-[clamp(0.75rem,2vw,0.875rem)] text-muted-foreground">
          Playing against{" "}
          <span className="text-accent font-medium">
            {DIFFICULTY_CONFIGS[game.difficulty].name}
          </span>{" "}
          AI
        </span>
      </div>

      {/* Game Board with Training Panel */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {coachReview && (
          <div className="mx-auto mb-2 w-full max-w-[min(95vw,56rem)] flex-shrink-0 rounded-lg border border-accent/30 bg-card/80 px-3 py-2 text-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                {coachReview.mode === "retry" && coachReview.selectedColumn != null ? (
                  retryMatchedRecommendation ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-400" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 text-yellow-400" />
                  )
                ) : (
                  <Lightbulb className="mt-0.5 h-4 w-4 text-accent" />
                )}
                <div>
                  <div className="font-medium">
                    {coachReview.mode === "retry"
                      ? coachReview.selectedColumn == null
                        ? "Retry the turning point"
                        : retryMatchedRecommendation
                          ? "That matched the coach move"
                          : "Coach move revealed"
                      : "Inspecting the turning point"}
                  </div>
                  <div className="text-muted-foreground">
                    Turn {coachReview.moment.turnNumber}, die {coachReview.moment.dieValue}:{" "}
                    {coachReview.mode === "retry" && coachReview.selectedColumn == null
                      ? "choose one column to practice the decision."
                      : `${formatColumn(coachReview.moment.recommendedColumn)} was stronger than ${formatColumn(coachReview.moment.chosenColumn)}.`}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                {coachReview.mode === "inspect" && (
                  <Button variant="outline" size="sm" onClick={handleRetryCoachMoment}>
                    <ListRestart className="mr-2 h-4 w-4" />
                    Retry
                  </Button>
                )}
                {coachReview.mode === "retry" && coachReview.selectedColumn != null && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCoachReview({
                        mode: "retry",
                        moment: coachReview.moment,
                        selectedColumn: null,
                      })
                    }
                  >
                    <ListRestart className="mr-2 h-4 w-4" />
                    Again
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={handleExitCoachReview}>
                  Exit
                </Button>
              </div>
            </div>
          </div>
        )}

        <GameBoard
          state={boardState}
          isRolling={coachReview ? false : game.isRolling}
          isThinking={coachReview ? false : game.isThinking}
          onRoll={coachReview ? undefined : game.roll}
          onColumnClick={
            isRetryAwaitingChoice ? handleRetryColumn : coachReview ? undefined : game.placeDie
          }
          player1Name="You"
          player2Name="AI"
          isPlayer1Human={!coachReview || isRetryAwaitingChoice}
          isPlayer2Human={false}
          moveAnalysis={boardMoveAnalysis}
          showProbabilities={coachReview ? shouldRevealCoachRecommendation : game.isTrainingMode}
          highlightedColumn={boardHighlightedColumn}
        />

        {/* Keyboard Shortcuts Widget */}
        {!coachReview && <KeyboardShortcuts />}

        {/* Training Mode Panel - shown below on mobile, would need different layout for desktop */}
        {!coachReview &&
          game.isTrainingMode &&
          game.state.phase === "placing" &&
          game.state.currentPlayer === "player1" && (
            <div className="hidden lg:absolute lg:right-4 lg:top-1/2 lg:-translate-y-1/2 lg:block w-72">
              <WinProbability
                analysis={game.moveAnalysis ?? []}
                onSelectColumn={(col: ColumnIndex) => game.placeDie(col)}
              />
            </div>
          )}
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Game Settings</DialogTitle>
            <DialogDescription>Adjust difficulty and game options</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>AI Difficulty</Label>
              <Select
                value={game.difficulty}
                onValueChange={(v) => handleDifficultyChange(v as DifficultyLevel)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DIFFICULTY_CONFIGS).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {DIFFICULTY_CONFIGS[game.difficulty].description}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <Label htmlFor="settings-public">Public Match</Label>
                <span className="text-xs text-muted-foreground">
                  Allow others to watch your matches
                </span>
              </div>
              <Switch
                id="settings-public"
                checked={isPublicMatch}
                onCheckedChange={async (checked) => {
                  setIsPublicMatch(checked);
                  if (checked && latestStateRef.current) {
                    await updatePublicRoom(latestStateRef.current);
                  } else {
                    publicRoomIdRef.current = null;
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="settings-training">Training Mode</Label>
              <Switch
                id="settings-training"
                checked={game.isTrainingMode}
                onCheckedChange={handleTrainingModeChange}
              />
            </div>

            {/* Clear History Section */}
            {gameHistory.history.length > 0 && (
              <div className="pt-4 border-t">
                <div className="space-y-2">
                  <Label className="text-destructive">Danger Zone</Label>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => {
                      setShowSettings(false);
                      setShowClearHistoryDialog(true);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear Game History ({gameHistory.history.length} games)
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    This will permanently delete all game history and reset statistics.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setShowSettings(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Game Over Dialog */}
      <Dialog open={showGameOver} onOpenChange={setShowGameOver}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-accent" />
              Game Over
            </DialogTitle>
            <DialogDescription>
              {lastWinner === "player1"
                ? "Congratulations! You won!"
                : lastWinner === "player2"
                  ? "The AI won this time. Try again!"
                  : "It's a draw!"}
            </DialogDescription>
          </DialogHeader>

          {coachBrief && primaryCoachMoment && (
            <div className="space-y-3 rounded-lg border border-accent/30 bg-card/80 p-3">
              <div className="flex gap-2">
                <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" />
                <div>
                  <div className="text-sm font-medium">Coach takeaway</div>
                  <p className="text-sm text-muted-foreground">{coachBrief.summary}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div>
                  <div className="text-muted-foreground">Final</div>
                  <div className="font-mono font-medium">
                    {coachBrief.finalScore.player1}-{coachBrief.finalScore.player2}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Difficulty</div>
                  <div className="font-medium">
                    {DIFFICULTY_CONFIGS[coachBrief.difficulty].name}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Turns</div>
                  <div className="font-mono font-medium">{coachBrief.turnCount}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Training</div>
                  <div className="font-medium">{coachBrief.trainingMode ? "On" : "Off"}</div>
                </div>
              </div>

              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-md bg-muted/30 p-2">
                  <div className="text-xs text-muted-foreground">Your move</div>
                  <div className="font-medium">
                    {formatColumn(primaryCoachMoment.chosenColumn)} at{" "}
                    {formatWinProbability(primaryCoachMoment.chosenMove.winProbability)}
                  </div>
                </div>
                <div className="rounded-md bg-accent/15 p-2">
                  <div className="text-xs text-muted-foreground">Coach move</div>
                  <div className="font-medium">
                    {formatColumn(primaryCoachMoment.recommendedColumn)} at{" "}
                    {formatWinProbability(primaryCoachMoment.recommendedMove.winProbability)}
                  </div>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                Win projection +{formatWinDelta(primaryCoachMoment.winProbabilityDelta)}
                {primaryCoachMoment.scoreSwingDelta > 0
                  ? `, score swing +${primaryCoachMoment.scoreSwingDelta.toFixed(1)}`
                  : ""}
                {primaryCoachMoment.missedDiceRemoved > 0
                  ? `, ${primaryCoachMoment.missedDiceRemoved} missed removal${primaryCoachMoment.missedDiceRemoved === 1 ? "" : "s"}`
                  : ""}
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-wrap gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setShowGameOver(false)}>
              View Board
            </Button>
            {primaryCoachMoment && (
              <Button variant="outline" onClick={handleInspectCoachMoment}>
                <Eye className="mr-2 h-4 w-4" />
                Inspect
              </Button>
            )}
            {primaryCoachMoment && (
              <Button onClick={handleRetryCoachMoment}>
                <ListRestart className="mr-2 h-4 w-4" />
                Retry
              </Button>
            )}
            <Button variant={primaryCoachMoment ? "outline" : "default"} onClick={handleNewGame}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Play Again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear History Confirmation Dialog */}
      <Dialog open={showClearHistoryDialog} onOpenChange={setShowClearHistoryDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              Clear Game History?
            </DialogTitle>
            <DialogDescription>
              This will permanently delete all {gameHistory.history.length} game
              {gameHistory.history.length !== 1 ? "s" : ""} from your history and reset your
              statistics. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setShowClearHistoryDialog(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                gameHistory.clearHistory();
                setShowClearHistoryDialog(false);
              }}
              className="flex-1"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear History
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <PlayContent />
    </Suspense>
  );
}

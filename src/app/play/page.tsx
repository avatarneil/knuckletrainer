"use client";

import {
  ArrowLeft,
  GraduationCap,
  RotateCcw,
  Settings,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { GameBoard } from "@/components/game";
import { WinProbability } from "@/components/training";
import { Button } from "@/components/ui/button";
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
import { DIFFICULTY_CONFIGS } from "@/engine";
import type { ColumnIndex, DifficultyLevel } from "@/engine/types";
import { useGame } from "@/hooks/useGame";

function PlayContent() {
  const searchParams = useSearchParams();
  const initialDifficulty =
    (searchParams.get("difficulty") as DifficultyLevel) || "medium";
  const initialTraining = searchParams.get("training") === "true";

  const [showSettings, setShowSettings] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [lastWinner, setLastWinner] = useState<
    "player1" | "player2" | "draw" | null
  >(null);

  const handleGameEnd = useCallback(
    (winner: "player1" | "player2" | "draw") => {
      setLastWinner(winner);
      setShowGameOver(true);
    },
    [],
  );

  const game = useGame({
    mode: "ai",
    difficulty: initialDifficulty,
    trainingMode: initialTraining,
    onGameEnd: handleGameEnd,
  });

  const handleNewGame = () => {
    game.resetGame();
    setShowGameOver(false);
    setLastWinner(null);
  };

  return (
    <main className="h-[100dvh] flex flex-col p-[clamp(0.5rem,2vw,1.5rem)] overflow-hidden pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {/* Header */}
      <header className="flex items-center justify-between mb-[clamp(0.5rem,1.5vw,1rem)] flex-shrink-0">
        <Link href="/">
          <Button variant="ghost" size="sm" className="px-[clamp(0.5rem,1.5vw,0.75rem)]">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden xs:inline ml-2">Back</span>
          </Button>
        </Link>

        <div className="flex items-center gap-[clamp(0.25rem,1vw,0.5rem)]">
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
              onCheckedChange={game.toggleTrainingMode}
            />
          </div>

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
      <div className="flex-1 flex flex-col min-h-0">
        <GameBoard
          state={game.state}
          isRolling={game.isRolling}
          onRoll={game.roll}
          onColumnClick={game.placeDie}
          player1Name="You"
          player2Name="AI"
          isPlayer1Human={true}
          isPlayer2Human={false}
          moveAnalysis={game.moveAnalysis ?? undefined}
          showProbabilities={game.isTrainingMode}
        />

        {/* Training Mode Panel - shown below on mobile, would need different layout for desktop */}
        {game.isTrainingMode &&
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
            <DialogDescription>
              Adjust difficulty and game options
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>AI Difficulty</Label>
              <Select
                value={game.difficulty}
                onValueChange={(v) => game.setDifficulty(v as DifficultyLevel)}
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
              <Label htmlFor="settings-training">Training Mode</Label>
              <Switch
                id="settings-training"
                checked={game.isTrainingMode}
                onCheckedChange={game.toggleTrainingMode}
              />
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowSettings(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Game Over Dialog */}
      <Dialog open={showGameOver} onOpenChange={setShowGameOver}>
        <DialogContent>
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

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowGameOver(false)}>
              View Board
            </Button>
            <Button onClick={handleNewGame}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Play Again
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

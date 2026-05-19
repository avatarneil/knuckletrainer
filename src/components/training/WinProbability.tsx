"use client";

import { ChevronDown, ChevronUp, Info, Target, Trash2, TrendingUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ColumnIndex, MoveAnalysis } from "@/engine/types";
import { cn } from "@/lib/utils";

interface WinProbabilityProps {
  analysis: MoveAnalysis[];
  onSelectColumn?: (column: ColumnIndex) => void;
  isAnalyzing?: boolean;
  variant?: "panel" | "tray";
  isExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

export function WinProbability({
  analysis,
  onSelectColumn,
  isAnalyzing = false,
  variant = "panel",
  isExpanded = false,
  onExpandedChange,
}: WinProbabilityProps) {
  if (isAnalyzing) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card/50 border border-border/50">
        <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground">Analyzing moves...</span>
      </div>
    );
  }

  if (analysis.length === 0) {
    return;
  }

  const bestMove = analysis.reduce((best, move) =>
    move.winProbability > best.winProbability ? move : best
  );
  const sortedAnalysis = analysis.toSorted((a, b) => b.winProbability - a.winProbability);

  const getProbabilityCue = (move: MoveAnalysis, isBest: boolean) => {
    if (isBest) {
      return "Best";
    }
    if (move.winProbability >= 0.5) {
      return "Good";
    }
    if (move.winProbability >= 0.3) {
      return "Watch";
    }
    return "Risk";
  };

  const getProbabilityTone = (move: MoveAnalysis, isBest: boolean) =>
    isBest
      ? "bg-accent/20 text-accent border-accent/50"
      : move.winProbability >= 0.5
        ? "bg-green-500/20 text-green-300 border-green-500/40"
        : move.winProbability >= 0.3
          ? "bg-yellow-500/20 text-yellow-200 border-yellow-500/40"
          : "bg-red-500/20 text-red-300 border-red-500/40";

  const renderMoveButton = (move: MoveAnalysis, rank: number, showTooltip: boolean) => {
    const isBest = move.column === bestMove.column;
    const probPercent = (move.winProbability * 100).toFixed(0);
    const cue = getProbabilityCue(move, isBest);
    const button = (
      <button
        key={move.column}
        type="button"
        onClick={() => onSelectColumn?.(move.column)}
        aria-label={`Column ${move.column + 1}. ${cue} training move. Rank ${rank}. Win probability ${probPercent} percent. Immediate score gain ${move.immediateScoreGain}. ${
          move.opponentDiceRemoved > 0
            ? `Removes ${move.opponentDiceRemoved} opponent dice.`
            : "Removes no opponent dice."
        }`}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isBest ? "bg-accent/20 border border-accent/50" : "bg-muted/30 hover:bg-muted/50"
        )}
      >
        {/* Column indicator */}
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center font-bold shrink-0",
            isBest ? "bg-accent text-accent-foreground" : "bg-muted"
          )}
        >
          {move.column + 1}
        </div>

        {/* Stats */}
        <div className="flex-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm min-w-0">
          {/* Win probability */}
          <div className="flex items-center gap-1">
            <Target className="w-4 h-4 text-muted-foreground" />
            <span className="font-mono font-medium">{probPercent}%</span>
          </div>

          {/* Score gain */}
          <div className="flex items-center gap-1">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">+{move.immediateScoreGain}</span>
          </div>

          {/* Dice removed */}
          {move.opponentDiceRemoved > 0 && (
            <div className="flex items-center gap-1">
              <Trash2 className="w-4 h-4 text-destructive" />
              <span className="text-destructive">-{move.opponentDiceRemoved}</span>
            </div>
          )}
        </div>

        {/* Cue indicator */}
        <span
          className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full border shrink-0",
            getProbabilityTone(move, isBest)
          )}
        >
          {cue}
        </span>
      </button>
    );

    if (!showTooltip) {
      return button;
    }

    return (
      <Tooltip key={move.column}>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <div className="space-y-1 text-xs">
            <p>
              <strong>Column {move.column + 1}</strong>
            </p>
            <p>Win probability: {probPercent}%</p>
            <p>Immediate score: +{move.immediateScoreGain}</p>
            <p>Expected score diff: {move.expectedScore.toFixed(1)}</p>
            {move.opponentDiceRemoved > 0 && (
              <p>Removes {move.opponentDiceRemoved} opponent dice</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  };

  const renderTrayMoveButton = (move: MoveAnalysis, rank: number) => {
    const isBest = move.column === bestMove.column;
    const probPercent = (move.winProbability * 100).toFixed(0);
    const cue = getProbabilityCue(move, isBest);

    return (
      <button
        key={move.column}
        type="button"
        onClick={() => onSelectColumn?.(move.column)}
        aria-label={`Column ${move.column + 1}. ${cue} training move. Rank ${rank}. Win probability ${probPercent} percent. Immediate score gain ${move.immediateScoreGain}. ${
          move.opponentDiceRemoved > 0
            ? `Removes ${move.opponentDiceRemoved} opponent dice.`
            : "Removes no opponent dice."
        }`}
        className={cn(
          "min-w-0 rounded-xl px-2 py-2 border text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isBest ? "bg-accent/20 border-accent/50" : "bg-muted/30 border-border/50"
        )}
      >
        <div
          className={cn(
            "mx-auto mb-1 h-8 w-8 rounded-lg flex items-center justify-center font-bold",
            isBest ? "bg-accent text-accent-foreground" : "bg-muted"
          )}
        >
          {move.column + 1}
        </div>
        <div className="flex items-center justify-center gap-1 text-xs">
          <Target className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono">{probPercent}%</span>
        </div>
        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>+{move.immediateScoreGain}</span>
        </div>
        <span
          className={cn(
            "mt-1 inline-flex text-xs font-medium px-2 py-0.5 rounded-full border",
            getProbabilityTone(move, isBest)
          )}
        >
          {cue}
        </span>
      </button>
    );
  };

  if (variant === "tray") {
    const bestPercent = (bestMove.winProbability * 100).toFixed(0);

    return (
      <section
        aria-label="Move analysis"
        className="rounded-xl bg-card/90 border border-border/60 shadow-lg shadow-black/20 p-3"
      >
        <button
          type="button"
          className="w-full flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
          onClick={() => onExpandedChange?.(!isExpanded)}
          aria-expanded={isExpanded}
        >
          <div className="h-9 w-9 rounded-lg bg-accent/20 text-accent flex items-center justify-center shrink-0">
            <Target className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span>Best move: column {bestMove.column + 1}</span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/50">
                Best
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {bestPercent}% win chance, +{bestMove.immediateScoreGain} immediate score
            </p>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </button>

        {isExpanded && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {sortedAnalysis.map((move, index) => renderTrayMoveButton(move, index + 1))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section
      aria-label="Move analysis"
      className="space-y-3 p-4 rounded-xl bg-card/80 border border-border/50"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Info className="w-4 h-4" />
        Move Analysis
      </div>

      <div className="space-y-2">
        {sortedAnalysis.map((move, index) => renderMoveButton(move, index + 1, true))}
      </div>
    </section>
  );
}

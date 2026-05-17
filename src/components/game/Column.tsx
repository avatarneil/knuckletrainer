"use client";

import { calculateColumnScore } from "@/engine/scorer";
import type { ColumnIndex, Column as ColumnType } from "@/engine/types";
import { cn } from "@/lib/utils";
import { DieSlot } from "./Die";

interface ColumnProps {
  column: ColumnType;
  columnIndex: ColumnIndex;
  isClickable?: boolean;
  isHighlighted?: boolean;
  isRecommended?: boolean;
  recommendationLabel?: string;
  accessibleLabel?: string;
  winProbability?: number;
  showProbability?: boolean;
  onClick?: () => void;
  isOpponent?: boolean;
  newDieIndex?: number;
  removingIndices?: number[];
}

export function Column({
  column,
  columnIndex,
  isClickable = false,
  isHighlighted = false,
  isRecommended = false,
  recommendationLabel,
  accessibleLabel,
  winProbability,
  showProbability = false,
  onClick,
  isOpponent = false,
  newDieIndex,
  removingIndices = [],
}: ColumnProps) {
  const score = calculateColumnScore(column, columnIndex);
  const probabilityCue =
    recommendationLabel ??
    (winProbability === undefined
      ? undefined
      : winProbability >= 0.5
        ? "Good"
        : winProbability >= 0.3
          ? "Watch"
          : "Risk");

  // For opponent, reverse the visual order (their row 0 is at bottom from our view)
  const displayColumn = isOpponent ? [...column].toReversed() : column;
  const displayIndices = isOpponent ? [2, 1, 0] : [0, 1, 2];

  return (
    <button
      type="button"
      onClick={isClickable ? onClick : undefined}
      disabled={!isClickable}
      aria-label={accessibleLabel}
      aria-disabled={!isClickable}
      className={cn(
        "flex flex-col gap-[clamp(0.25rem,1vmin,0.75rem)] p-[clamp(0.25rem,1.5vmin,0.75rem)] min-w-[clamp(3rem,9vmin,5.5rem)] rounded-lg sm:rounded-xl transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isClickable &&
          "cursor-pointer hover:bg-muted/50 hover:scale-105 hover:transition-transform",
        isHighlighted && "ring-2 ring-accent animate-pulse-glow",
        isRecommended && "ring-2 ring-accent bg-accent/10",
        !isClickable && "cursor-default"
      )}
    >
      {/* Column score */}
      <div
        className={cn(
          "text-center font-mono font-bold text-[clamp(0.875rem,2.5vw,1.125rem)] transition-colors",
          score.total > 0 ? "text-accent" : "text-muted-foreground"
        )}
      >
        {score.total}
      </div>

      {/* Dice slots */}
      <div className="flex flex-col gap-[clamp(0.25rem,1vmin,0.75rem)]">
        {displayColumn.map((die, displayIdx) => {
          const actualIndex = displayIndices[displayIdx];
          return (
            <DieSlot
              key={actualIndex}
              value={die}
              size="md"
              isNew={actualIndex === newDieIndex}
              isRemoving={removingIndices.includes(actualIndex)}
            />
          );
        })}
      </div>

      {/* Win probability indicator (training mode) */}
      {showProbability && winProbability !== undefined && (
        <div
          className={cn(
            "text-center text-[clamp(0.625rem,1.5vw,0.75rem)] font-medium rounded-lg px-[clamp(0.375rem,1vw,0.5rem)] py-[clamp(0.125rem,0.5vw,0.25rem)] transition-colors border leading-tight",
            isRecommended
              ? "bg-accent/20 text-accent border-accent/50"
              : winProbability >= 0.5
                ? "bg-green-500/20 text-green-300 border-green-500/40"
                : winProbability >= 0.3
                  ? "bg-yellow-500/20 text-yellow-200 border-yellow-500/40"
                  : "bg-red-500/20 text-red-300 border-red-500/40"
          )}
        >
          <span className="block">{(winProbability * 100).toFixed(0)}%</span>
          {probabilityCue && <span className="block text-[0.625rem]">{probabilityCue}</span>}
        </div>
      )}
    </button>
  );
}

"use client";

import { Loader2 } from "lucide-react";
import { calculateColumnScore, calculateGridScore } from "@/engine/scorer";
import type { ColumnIndex, Grid, MoveAnalysis } from "@/engine/types";
import { ALL_COLUMNS } from "@/engine/types";
import { cn } from "@/lib/utils";
import { Column } from "./Column";

interface PlayerGridProps {
  grid: Grid;
  playerName: string;
  isCurrentPlayer?: boolean;
  isOpponent?: boolean;
  canPlaceDie?: boolean;
  onColumnClick?: (column: ColumnIndex) => void;
  legalColumns?: ColumnIndex[];
  moveAnalysis?: MoveAnalysis[];
  showProbabilities?: boolean;
  highlightedColumn?: ColumnIndex | null;
  newDieColumn?: ColumnIndex | null;
  newDieRow?: number | null;
  removingDice?: { column: ColumnIndex; indices: number[] }[];
  isThinking?: boolean;
}

export function PlayerGrid({
  grid,
  playerName,
  isCurrentPlayer = false,
  isOpponent = false,
  canPlaceDie = false,
  onColumnClick,
  legalColumns = [],
  moveAnalysis,
  showProbabilities = false,
  highlightedColumn,
  newDieColumn,
  newDieRow,
  removingDice = [],
  isThinking = false,
}: PlayerGridProps) {
  const score = calculateGridScore(grid);
  const rankedAnalysis = moveAnalysis
    ? moveAnalysis.toSorted((a, b) => b.winProbability - a.winProbability)
    : [];
  const bestColumn = rankedAnalysis[0]?.column;

  const getMoveAnalysis = (column: ColumnIndex): MoveAnalysis | undefined => {
    if (!moveAnalysis) {
      return undefined;
    }
    return moveAnalysis.find((m) => m.column === column);
  };

  const getRecommendationRank = (column: ColumnIndex): number | undefined => {
    const index = rankedAnalysis.findIndex((m) => m.column === column);
    return index >= 0 ? index + 1 : undefined;
  };

  const getRemovingIndices = (column: ColumnIndex): number[] => {
    const removing = removingDice.find((r) => r.column === column);
    return removing?.indices ?? [];
  };

  const getColumnLabel = (column: ColumnIndex): string => {
    const columnScore = calculateColumnScore(grid[column], column);
    const isLegal = canPlaceDie && legalColumns.includes(column);
    const isFull = grid[column].every((die) => die !== null);
    const analysis = getMoveAnalysis(column);
    const rank = getRecommendationRank(column);
    const parts = [
      `${playerName} column ${column + 1}`,
      `score ${columnScore.total}`,
      isLegal ? "legal move" : isFull ? "full column" : "disabled this turn",
    ];

    if (analysis && rank !== undefined) {
      const probability = (analysis.winProbability * 100).toFixed(0);
      parts.push(
        rank === 1 ? "training recommendation: best move" : `training recommendation rank ${rank}`,
        `${probability} percent win chance`,
        `immediate score gain ${analysis.immediateScoreGain}`
      );
      if (analysis.opponentDiceRemoved > 0) {
        parts.push(`removes ${analysis.opponentDiceRemoved} opponent dice`);
      }
    }

    return parts.join(", ");
  };

  return (
    <section
      aria-label={`${playerName} grid, total score ${score.total}`}
      className={cn(
        "flex flex-col items-center gap-[clamp(0.125rem,1vmin,0.5rem)] p-[clamp(0.25rem,1.5vmin,1rem)] rounded-xl sm:rounded-2xl transition-colors duration-300 min-h-0 flex-shrink",
        isCurrentPlayer && !isOpponent && "ring-2 ring-accent/50 bg-accent/5"
      )}
    >
      {/* Player info */}
      <div className="flex items-center gap-[clamp(0.5rem,1.5vw,0.75rem)]">
        <div
          className={cn(
            "w-[clamp(0.5rem,1.5vw,0.75rem)] h-[clamp(0.5rem,1.5vw,0.75rem)] rounded-full transition-colors",
            isCurrentPlayer ? "bg-accent animate-pulse" : "bg-muted-foreground/30"
          )}
        />
        <span className="font-semibold text-[clamp(0.875rem,2.5vw,1.125rem)]">{playerName}</span>
        {isThinking && <Loader2 className="w-4 h-4 animate-spin text-accent" />}
        <div
          className={cn(
            "font-mono font-bold text-[clamp(1.125rem,3.5vw,1.5rem)] tabular-nums transition-colors",
            isCurrentPlayer ? "text-accent" : "text-foreground"
          )}
        >
          {score.total}
        </div>
      </div>

      {/* Grid */}
      <div
        className={cn(
          "flex gap-[clamp(0.25rem,1.5vmin,1rem)] p-[clamp(0.375rem,2vmin,1rem)] rounded-lg sm:rounded-xl bg-card/80 border border-border/50"
        )}
      >
        {ALL_COLUMNS.map((colIndex) => (
          <Column
            key={colIndex}
            column={grid[colIndex]}
            columnIndex={colIndex}
            isClickable={canPlaceDie && legalColumns.includes(colIndex)}
            isHighlighted={highlightedColumn === colIndex}
            isRecommended={bestColumn === colIndex}
            recommendationLabel={
              bestColumn === colIndex
                ? "Best"
                : getRecommendationRank(colIndex) !== undefined
                  ? `Rank ${getRecommendationRank(colIndex)}`
                  : undefined
            }
            accessibleLabel={getColumnLabel(colIndex)}
            onClick={() => onColumnClick?.(colIndex)}
            isOpponent={isOpponent}
            winProbability={getMoveAnalysis(colIndex)?.winProbability}
            showProbability={showProbabilities && legalColumns.includes(colIndex)}
            newDieIndex={newDieColumn === colIndex ? (newDieRow ?? undefined) : undefined}
            removingIndices={getRemovingIndices(colIndex)}
          />
        ))}
      </div>

      {/* Column scores breakdown - hidden on very small screens */}
      <div className="hidden xs:flex gap-[clamp(0.75rem,2.5vw,1rem)] text-[clamp(0.625rem,1.5vw,0.75rem)] text-muted-foreground">
        {score.columns.map((col) => (
          <div key={`col-score-${col.column}`} className="text-center">
            <span className="font-mono">{col.total}</span>
            {col.multiplier > 1 && (
              <span className="text-accent ml-1">×{col.multiplier.toFixed(0)}</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

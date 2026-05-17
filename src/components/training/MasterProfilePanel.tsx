"use client";

import { Brain, RotateCcw, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MasterProfileStats } from "@/engine";
import { cn } from "@/lib/utils";

interface MasterProfilePanelProps {
  stats: MasterProfileStats;
  isAvailable: boolean;
  onReset: () => void;
  className?: string;
}

const COLUMN_LABELS = ["left", "middle", "right"] as const;

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function describeColumnPreference(stats: MasterProfileStats): string {
  if (stats.totalMoves === 0) {
    return "No column pattern yet";
  }

  const maxIndex = stats.columnFrequencies.reduce(
    (bestIndex, frequency, index, frequencies) =>
      frequency > frequencies[bestIndex] ? index : bestIndex,
    0
  );
  let strongestFrequency = 0;
  let secondStrongestFrequency = 0;
  for (const frequency of stats.columnFrequencies) {
    if (frequency > strongestFrequency) {
      secondStrongestFrequency = strongestFrequency;
      strongestFrequency = frequency;
    } else if (frequency > secondStrongestFrequency) {
      secondStrongestFrequency = frequency;
    }
  }
  const lead = strongestFrequency - secondStrongestFrequency;

  if (lead < 0.08) {
    return "No strong column preference yet";
  }

  return `Favors the ${COLUMN_LABELS[maxIndex]} column (${formatPercent(
    stats.columnFrequencies[maxIndex]
  )} of observed moves)`;
}

function describeAttackTendency(stats: MasterProfileStats): string {
  if (stats.totalMoves === 0) {
    return "No attack pattern yet";
  }

  if (stats.attackRate >= 0.4) {
    return `Often attacks matching dice (${formatPercent(stats.attackRate)} of moves)`;
  }

  if (stats.attackRate <= 0.2) {
    return `Usually builds before attacking (${formatPercent(stats.attackRate)} attack rate)`;
  }

  return `Mixes attacks and building (${formatPercent(stats.attackRate)} attack rate)`;
}

function getStatus(
  stats: MasterProfileStats,
  isAvailable: boolean
): {
  label: string;
  description: string;
  tone: string;
  dot: string;
} {
  if (!isAvailable) {
    return {
      description: "Master is using strong fallback play until local adaptive learning is ready.",
      dot: "bg-muted-foreground",
      label: "Fallback",
      tone: "text-muted-foreground",
    };
  }

  if (stats.hasLearned) {
    return {
      description: "Master is adapting to the tendencies in this local profile.",
      dot: "bg-accent",
      label: "Adapting",
      tone: "text-accent",
    };
  }

  const movesNeeded = Math.max(0, 10 - stats.totalMoves);
  const gamesNeeded = Math.max(0, 3 - stats.gamesCompleted);

  return {
    description: `Master needs ${movesNeeded} more move${movesNeeded === 1 ? "" : "s"} and ${gamesNeeded} more completed game${gamesNeeded === 1 ? "" : "s"} before adapting.`,
    dot: "bg-secondary",
    label: "Learning",
    tone: "text-secondary-foreground",
  };
}

export function MasterProfilePanel({
  className,
  isAvailable,
  onReset,
  stats,
}: MasterProfilePanelProps) {
  const status = getStatus(stats, isAvailable);
  const hasEvidence = stats.totalMoves > 0 || stats.gamesCompleted > 0;

  return (
    <section className={cn("rounded-lg border bg-muted/30 p-4 space-y-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold">Master Profile</h3>
        </div>
        <span className={cn("flex items-center gap-1.5 text-[0.6875rem] font-medium", status.tone)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} aria-hidden />
          {status.label}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">{status.description}</p>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md border bg-background/40 p-2">
          <div className="text-muted-foreground">Observed moves</div>
          <div className="text-base font-semibold">{stats.totalMoves}</div>
        </div>
        <div className="rounded-md border bg-background/40 p-2">
          <div className="text-muted-foreground">Completed games</div>
          <div className="text-base font-semibold">{stats.gamesCompleted}</div>
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex gap-2">
          <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
          <span>{describeColumnPreference(stats)}</span>
        </div>
        <div className="flex gap-2">
          <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>{describeAttackTendency(stats)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
          Local to this app run. Reloading clears this profile.
        </p>
        <Button variant="outline" size="sm" onClick={onReset} disabled={!hasEvidence}>
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>
    </section>
  );
}

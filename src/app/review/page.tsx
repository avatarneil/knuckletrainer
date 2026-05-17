"use client";

import { ArrowLeft, Check, History, RotateCcw, Target, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GameBoard } from "@/components/game";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import type { ColumnIndex } from "@/engine/types";
import { useReviewQueue } from "@/hooks/useReviewQueue";
import { reviewQueueStorage } from "@/lib/review-queue";
import type { ReviewItem } from "@/lib/review-queue";
import { cn } from "@/lib/utils";

function formatColumn(column: ColumnIndex): string {
  return `Column ${column + 1}`;
}

function formatGap(item: ReviewItem): string {
  const winGap = Math.max(0, item.winProbabilityGap * 100).toFixed(0);
  const scoreGap = Math.max(0, item.expectedScoreGap).toFixed(1);
  return `${winGap}% win gap, ${scoreGap} expected score`;
}

function formatTime(timestamp: number): string {
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${Math.floor(hours / 24)}d ago`;
}

function getNextItem(items: ReviewItem[], currentId: string): ReviewItem | null {
  return (
    items.find((item) => item.id !== currentId && item.status === "unresolved") ??
    items.find((item) => item.id !== currentId) ??
    null
  );
}

export default function ReviewPage() {
  const reviewQueue = useReviewQueue();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<ColumnIndex | null>(null);

  const activeItem = useMemo(
    () => reviewQueue.items.find((item) => item.id === activeId) ?? reviewQueue.items[0] ?? null,
    [activeId, reviewQueue.items]
  );

  useEffect(() => {
    if (reviewQueue.items.length === 0) {
      setActiveId(null);
      setSelectedColumn(null);
      return;
    }

    if (!activeId || !reviewQueue.items.some((item) => item.id === activeId)) {
      setActiveId(reviewQueue.items[0].id);
      setSelectedColumn(null);
    }
  }, [activeId, reviewQueue.items]);

  const hasFeedback = selectedColumn !== null && activeItem !== null;
  const isCorrect =
    activeItem !== null && selectedColumn !== null && selectedColumn === activeItem.bestColumn;

  const selectItem = (id: string) => {
    setActiveId(id);
    setSelectedColumn(null);
  };

  const handleChooseColumn = (column: ColumnIndex) => {
    if (!activeItem || selectedColumn !== null || !activeItem.legalColumns.includes(column)) {
      return;
    }

    reviewQueue.recordAttempt(activeItem.id, column);
    setSelectedColumn(column);
  };

  const handleNext = () => {
    if (!activeItem) {
      return;
    }

    const nextItem = getNextItem(reviewQueue.items, activeItem.id);
    if (nextItem) {
      setActiveId(nextItem.id);
      setSelectedColumn(null);
    }
  };

  const handleDelete = (item: ReviewItem) => {
    reviewQueue.deleteItem(item.id);
    if (item.id === activeId) {
      setSelectedColumn(null);
    }
  };

  const handleClear = () => {
    if (window.confirm("Clear every saved review drill?")) {
      reviewQueue.clearQueue();
    }
  };

  if (reviewQueue.items.length === 0) {
    return (
      <main
        className="min-h-screen flex flex-col p-6"
        style={{
          paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
          paddingTop: "max(1.5rem, calc(env(safe-area-inset-top) + 1rem))",
        }}
      >
        <header className="flex items-center justify-between">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <ThemeSwitcher />
        </header>

        <section className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-5 text-center">
          <div className="rounded-full bg-accent/15 p-5 text-accent">
            <History className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Review Queue</h1>
            <p className="text-muted-foreground">No saved drills yet.</p>
          </div>
          <Button asChild size="lg">
            <Link href="/play?training=true">
              <Target className="mr-2 h-4 w-4" />
              Play Training Game
            </Link>
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen flex flex-col p-[clamp(0.75rem,2vw,1.5rem)]"
      style={{
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
        paddingTop: "max(1rem, calc(env(safe-area-inset-top) + 0.5rem))",
      }}
    >
      <header className="flex items-center justify-between gap-3 pb-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden xs:inline">Back</span>
          </Link>
        </Button>

        <div className="min-w-0 text-center">
          <h1 className="truncate text-xl font-bold">Review Queue</h1>
          <p className="text-xs text-muted-foreground">
            {reviewQueue.unresolvedCount} unresolved · {reviewQueue.masteredCount} mastered
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <Button variant="outline" size="sm" onClick={handleClear}>
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Clear</span>
          </Button>
        </div>
      </header>

      <div className="grid flex-1 gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="min-h-0 rounded-xl border border-border/50 bg-card/70 p-3">
          <div className="mb-3 flex items-center justify-between px-1">
            <span className="text-sm font-medium text-muted-foreground">Drills</span>
            <span className="text-xs text-muted-foreground">{reviewQueue.items.length} saved</span>
          </div>

          <div className="max-h-[35vh] space-y-2 overflow-y-auto pr-1 lg:max-h-[calc(100dvh-10rem)]">
            {reviewQueue.items.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex w-full items-start justify-between gap-3 rounded-lg border p-3 transition-colors",
                  item.id === activeItem?.id
                    ? "border-accent bg-accent/10"
                    : "border-border/50 bg-background/60 hover:bg-muted/50"
                )}
              >
                <button
                  type="button"
                  onClick={() => selectItem(item.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">Turn {item.gameTurn}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[0.625rem] font-medium uppercase tracking-wide",
                          item.severity === "high"
                            ? "bg-destructive/20 text-destructive"
                            : "bg-accent/15 text-accent"
                        )}
                      >
                        {item.severity}
                      </span>
                      {item.status === "mastered" && (
                        <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[0.625rem] font-medium uppercase tracking-wide text-green-400">
                          mastered
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {reviewQueueStorage.getReasonLabel(item.reasonCategory)} ·{" "}
                      {formatTime(item.createdAt)}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {item.attempts} attempts · {item.misses} misses · streak {item.correctStreak}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleDelete(item);
                  }}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Delete drill from turn ${item.gameTurn}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </aside>

        {activeItem && (
          <section className="flex min-h-0 flex-col gap-4">
            <div className="rounded-xl border border-border/50 bg-card/70 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Turn {activeItem.gameTurn}</h2>
                  <p className="text-sm text-muted-foreground">
                    {hasFeedback ? "Feedback revealed" : "Choose your column"}
                  </p>
                </div>

                {hasFeedback && (
                  <Button variant="outline" size="sm" onClick={() => setSelectedColumn(null)}>
                    <RotateCcw className="h-4 w-4" />
                    Try Again
                  </Button>
                )}
              </div>

              <div className="min-h-[28rem] rounded-lg border border-border/50 bg-background/40">
                <GameBoard
                  state={activeItem.state}
                  onColumnClick={selectedColumn === null ? handleChooseColumn : undefined}
                  player1Name="You"
                  player2Name="AI"
                  isPlayer1Human={selectedColumn === null}
                  isPlayer2Human={false}
                  highlightedColumn={selectedColumn}
                />
              </div>
            </div>

            <div
              aria-live="polite"
              className={cn(
                "rounded-xl border p-4",
                hasFeedback
                  ? isCorrect
                    ? "border-green-500/40 bg-green-500/10"
                    : "border-destructive/40 bg-destructive/10"
                  : "border-border/50 bg-card/70"
              )}
            >
              {hasFeedback ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "rounded-full p-2",
                        isCorrect
                          ? "bg-green-500/20 text-green-400"
                          : "bg-destructive/20 text-destructive"
                      )}
                    >
                      {isCorrect ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
                    </div>
                    <div>
                      <h3 className="font-semibold">{isCorrect ? "Correct" : "Another pass"}</h3>
                      <p className="text-sm text-muted-foreground">
                        {reviewQueueStorage.getReasonLabel(activeItem.reasonCategory)}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 text-sm sm:grid-cols-3">
                    <div className="rounded-lg bg-background/60 p-3">
                      <p className="text-xs text-muted-foreground">Your answer</p>
                      <p className="font-medium">
                        {formatColumn(selectedColumn ?? activeItem.chosenColumn)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-background/60 p-3">
                      <p className="text-xs text-muted-foreground">Best move</p>
                      <p className="font-medium">{formatColumn(activeItem.bestColumn)}</p>
                    </div>
                    <div className="rounded-lg bg-background/60 p-3">
                      <p className="text-xs text-muted-foreground">Gap</p>
                      <p className="font-medium">{formatGap(activeItem)}</p>
                    </div>
                  </div>

                  <p className="text-sm leading-6">{activeItem.reason}</p>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleNext} disabled={reviewQueue.items.length <= 1}>
                      Next Drill
                    </Button>
                    <Button variant="outline" onClick={() => handleDelete(activeItem)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">Decision point</p>
                    <p className="text-sm text-muted-foreground">
                      Die {activeItem.state.currentDie} · {activeItem.legalColumns.length} legal
                      columns
                    </p>
                  </div>
                  <Target className="h-5 w-5 text-accent" />
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

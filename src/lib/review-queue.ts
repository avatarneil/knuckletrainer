"use client";

import { getLegalMoves } from "@/engine/moves";
import { calculateMoveScoreGain } from "@/engine/scorer";
import { cloneState, getStateHash } from "@/engine/state";
import { quickAnalysis } from "@/engine/training";
import type { ColumnIndex, GameState, MoveAnalysis } from "@/engine/types";

export type ReviewReasonCategory =
  | "missed-removal"
  | "missed-stack"
  | "poor-defense"
  | "low-value-trap"
  | "stronger-outcome";

export type ReviewSeverity = "medium" | "high";
export type ReviewStatus = "unresolved" | "mastered";

export interface ReviewItem {
  id: string;
  createdAt: number;
  updatedAt: number;
  lastReviewedAt: number | null;
  status: ReviewStatus;
  severity: ReviewSeverity;
  reasonCategory: ReviewReasonCategory;
  reason: string;
  state: GameState;
  stateHash: string;
  legalColumns: ColumnIndex[];
  chosenColumn: ColumnIndex;
  bestColumn: ColumnIndex;
  analysis: MoveAnalysis[];
  winProbabilityGap: number;
  expectedScoreGap: number;
  attempts: number;
  misses: number;
  correctStreak: number;
  gameTurn: number;
}

export interface ReviewCandidateInput {
  state: GameState;
  chosenColumn: ColumnIndex;
  analysis?: MoveAnalysis[] | null;
}

const STORAGE_KEY = "knucklebones:review-queue";
const MAX_REVIEW_ITEMS = 80;
// Match what the training UI makes visible: save clear non-best choices, but skip ties/noise.
const MEANINGFUL_WIN_GAP = 0.03;
const MEANINGFUL_SCORE_GAP = 4;

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readRawItems(): ReviewItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const item = localStorage.getItem(STORAGE_KEY);
    return item ? (JSON.parse(item) as ReviewItem[]) : [];
  } catch {
    return [];
  }
}

function writeItems(items: ReviewItem[]): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.error("Failed to save review queue:", error);
  }
}

function findBestMove(analysis: MoveAnalysis[]): MoveAnalysis | null {
  if (analysis.length === 0) {
    return null;
  }

  return analysis.reduce((best, move) => {
    if (move.winProbability !== best.winProbability) {
      return move.winProbability > best.winProbability ? move : best;
    }
    return move.expectedScore > best.expectedScore ? move : best;
  });
}

function getPriorityScore(item: ReviewItem): number {
  const severityWeight = item.severity === "high" ? 8 : 4;
  const missWeight = item.misses * 3;
  const freshnessWeight = item.lastReviewedAt === null ? 2 : 0;
  return severityWeight + missWeight + freshnessWeight - item.correctStreak;
}

function sortReviewItems(items: ReviewItem[]): ReviewItem[] {
  return items.toSorted((a, b) => {
    if (a.status !== b.status) {
      return a.status === "unresolved" ? -1 : 1;
    }

    const priorityDiff = getPriorityScore(b) - getPriorityScore(a);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return b.createdAt - a.createdAt;
  });
}

function getAnalysis(input: ReviewCandidateInput): MoveAnalysis[] {
  if (input.analysis && input.analysis.length > 0) {
    return input.analysis;
  }

  return quickAnalysis(input.state, 120).moves;
}

function categoryLabel(category: ReviewReasonCategory): string {
  switch (category) {
    case "missed-removal": {
      return "Missed removal";
    }
    case "missed-stack": {
      return "Missed stack";
    }
    case "poor-defense": {
      return "Poor defense";
    }
    case "low-value-trap": {
      return "Low-value trap";
    }
    case "stronger-outcome": {
      return "Stronger outcome";
    }
  }
}

function deriveReason(
  state: GameState,
  chosenMove: MoveAnalysis,
  bestMove: MoveAnalysis
): { category: ReviewReasonCategory; reason: string } {
  const dieValue = state.currentDie;
  const bestColumn = bestMove.column + 1;
  const chosenColumn = chosenMove.column + 1;
  const currentGrid = state.grids[state.currentPlayer];
  const bestStackCount =
    dieValue === null ? 0 : currentGrid[bestMove.column].filter((die) => die === dieValue).length;
  const chosenStackCount =
    dieValue === null ? 0 : currentGrid[chosenMove.column].filter((die) => die === dieValue).length;
  const bestGain =
    dieValue === null ? 0 : calculateMoveScoreGain(currentGrid, bestMove.column, dieValue);
  const chosenGain =
    dieValue === null ? 0 : calculateMoveScoreGain(currentGrid, chosenMove.column, dieValue);

  if (bestMove.opponentDiceRemoved > chosenMove.opponentDiceRemoved) {
    return {
      category: "missed-removal",
      reason: `Column ${bestColumn} removed more pressure from the opponent while keeping your position stronger.`,
    };
  }

  if (bestStackCount > chosenStackCount || bestGain >= chosenGain + 6) {
    return {
      category: "missed-stack",
      reason: `Column ${bestColumn} made better use of the current die and created a stronger scoring column.`,
    };
  }

  if (
    chosenMove.immediateScoreGain >= bestMove.immediateScoreGain &&
    bestMove.winProbability > chosenMove.winProbability
  ) {
    return {
      category: "low-value-trap",
      reason: `Column ${chosenColumn} looked useful immediately, but column ${bestColumn} led to the stronger position.`,
    };
  }

  if (bestMove.expectedScore > chosenMove.expectedScore + 8) {
    return {
      category: "poor-defense",
      reason: `Column ${bestColumn} improved the expected score gap and left fewer future problems to solve.`,
    };
  }

  return {
    category: "stronger-outcome",
    reason: `Column ${bestColumn} had the best overall analysis score for this position.`,
  };
}

function buildReviewItem(input: ReviewCandidateInput): ReviewItem | null {
  if (input.state.phase !== "placing" || input.state.currentDie === null) {
    return null;
  }

  const legalMoves = getLegalMoves(input.state);
  if (!legalMoves || legalMoves.columns.length <= 1) {
    return null;
  }

  let analysis: MoveAnalysis[];
  try {
    analysis = getAnalysis(input);
  } catch {
    return null;
  }

  const bestMove = findBestMove(analysis);
  const chosenMove = analysis.find((move) => move.column === input.chosenColumn);
  if (!bestMove || !chosenMove || bestMove.column === input.chosenColumn) {
    return null;
  }

  const winProbabilityGap = bestMove.winProbability - chosenMove.winProbability;
  const expectedScoreGap = bestMove.expectedScore - chosenMove.expectedScore;
  if (winProbabilityGap < MEANINGFUL_WIN_GAP && expectedScoreGap < MEANINGFUL_SCORE_GAP) {
    return null;
  }

  const severity: ReviewSeverity =
    winProbabilityGap >= 0.25 || expectedScoreGap >= 15 ? "high" : "medium";
  const reason = deriveReason(input.state, chosenMove, bestMove);
  const now = Date.now();

  return {
    analysis,
    attempts: 0,
    bestColumn: bestMove.column,
    chosenColumn: input.chosenColumn,
    correctStreak: 0,
    createdAt: now,
    expectedScoreGap,
    gameTurn: input.state.turnNumber,
    id: createId(),
    lastReviewedAt: null,
    legalColumns: legalMoves.columns,
    misses: 0,
    reason: reason.reason,
    reasonCategory: reason.category,
    severity,
    state: cloneState(input.state),
    stateHash: getStateHash(input.state),
    status: "unresolved",
    updatedAt: now,
    winProbabilityGap,
  };
}

export const reviewQueueStorage = {
  addCandidate(input: ReviewCandidateInput): ReviewItem | null {
    const item = buildReviewItem(input);
    if (!item) {
      return null;
    }

    const existing = readRawItems();
    const duplicate = existing.find(
      (candidate) =>
        candidate.stateHash === item.stateHash &&
        candidate.chosenColumn === item.chosenColumn &&
        candidate.bestColumn === item.bestColumn
    );

    if (duplicate) {
      return duplicate;
    }

    writeItems(sortReviewItems([item, ...existing]).slice(0, MAX_REVIEW_ITEMS));
    return item;
  },

  clear(): void {
    if (typeof window === "undefined") {
      return;
    }
    localStorage.removeItem(STORAGE_KEY);
  },

  deleteItem(id: string): void {
    writeItems(readRawItems().filter((item) => item.id !== id));
  },

  getItems(): ReviewItem[] {
    return sortReviewItems(readRawItems());
  },

  getReasonLabel(category: ReviewReasonCategory): string {
    return categoryLabel(category);
  },

  recordAttempt(id: string, selectedColumn: ColumnIndex): ReviewItem | null {
    let updatedItem: ReviewItem | null = null;
    const now = Date.now();
    const updated = readRawItems().map((item) => {
      if (item.id !== id) {
        return item;
      }

      const isCorrect = selectedColumn === item.bestColumn;
      const correctStreak = isCorrect ? item.correctStreak + 1 : 0;
      updatedItem = {
        ...item,
        attempts: item.attempts + 1,
        correctStreak,
        lastReviewedAt: now,
        misses: isCorrect ? item.misses : item.misses + 1,
        status: correctStreak >= 2 ? "mastered" : "unresolved",
        updatedAt: now,
      };
      return updatedItem;
    });

    writeItems(sortReviewItems(updated));
    return updatedItem;
  },
};

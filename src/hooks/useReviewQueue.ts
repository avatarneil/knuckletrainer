"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnIndex } from "@/engine/types";
import { reviewQueueStorage } from "@/lib/review-queue";
import type { ReviewCandidateInput, ReviewItem } from "@/lib/review-queue";

interface UseReviewQueueReturn {
  items: ReviewItem[];
  unresolvedCount: number;
  masteredCount: number;
  captureMistake: (input: ReviewCandidateInput) => ReviewItem | null;
  clearQueue: () => void;
  deleteItem: (id: string) => void;
  recordAttempt: (id: string, selectedColumn: ColumnIndex) => ReviewItem | null;
  refresh: () => void;
}

export function useReviewQueue(): UseReviewQueueReturn {
  const [items, setItems] = useState<ReviewItem[]>([]);

  const refresh = useCallback(() => {
    setItems(reviewQueueStorage.getItems());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const captureMistake = useCallback(
    (input: ReviewCandidateInput): ReviewItem | null => {
      const item = reviewQueueStorage.addCandidate(input);
      refresh();
      return item;
    },
    [refresh]
  );

  const clearQueue = useCallback(() => {
    reviewQueueStorage.clear();
    refresh();
  }, [refresh]);

  const deleteItem = useCallback(
    (id: string) => {
      reviewQueueStorage.deleteItem(id);
      refresh();
    },
    [refresh]
  );

  const recordAttempt = useCallback(
    (id: string, selectedColumn: ColumnIndex): ReviewItem | null => {
      const item = reviewQueueStorage.recordAttempt(id, selectedColumn);
      refresh();
      return item;
    },
    [refresh]
  );

  const unresolvedCount = useMemo(
    () => items.filter((item) => item.status === "unresolved").length,
    [items]
  );
  const masteredCount = items.length - unresolvedCount;

  return {
    captureMistake,
    clearQueue,
    deleteItem,
    items,
    masteredCount,
    recordAttempt,
    refresh,
    unresolvedCount,
  };
}

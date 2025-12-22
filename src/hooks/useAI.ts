"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  configureSimulations,
  createAIPlayer,
  getAllDifficultyLevels,
  getDifficultyConfig,
  setMaxNodes,
} from "@/engine";
import type { ColumnIndex, DifficultyLevel, GameState } from "@/engine/types";
import {
  getBestMoveAsync,
  initializeAIWorker,
  isWorkerAvailable,
} from "@/lib/ai-worker-manager";
import { getAIPerformanceConfig, getPlatformInfo } from "@/lib/platform";

interface UseAIReturn {
  difficulty: DifficultyLevel;
  setDifficulty: (level: DifficultyLevel) => void;
  getMove: (state: GameState) => ColumnIndex | null;
  getMoveAsync: (state: GameState) => Promise<ColumnIndex | null>;
  evaluateState: (state: GameState) => number;
  difficultyConfig: ReturnType<typeof getDifficultyConfig>;
  allDifficulties: DifficultyLevel[];
  isWorkerReady: boolean;
  platformInfo: ReturnType<typeof getPlatformInfo>;
}

/** Flag to track if performance has been configured */
let performanceConfigured = false;

/**
 * Configure AI performance based on platform
 * This is called once on first hook usage
 */
function configurePerformance(): void {
  if (performanceConfigured || typeof window === "undefined") {
    return;
  }

  const config = getAIPerformanceConfig();
  const platform = getPlatformInfo();

  // Log performance configuration for debugging
  console.log(
    `[AI Performance] Platform: ${platform.isIOS ? "iOS" : platform.isMobile ? "Mobile" : "Desktop"}, Tier: ${platform.performanceTier}`,
  );
  console.log(
    `[AI Performance] Max nodes: ${config.maxNodes}, Simulations: ${config.monteCarloSimulations}`,
  );

  // Configure expectimax node limits
  setMaxNodes(config.maxNodes);

  // Configure Monte Carlo simulations
  configureSimulations({
    defaultSimulations: config.monteCarloSimulations,
    quickSimulations: Math.min(config.monteCarloSimulations, 400),
    deepSimulations: Math.min(config.monteCarloSimulations * 2, 1500),
  });

  // Initialize web worker
  if (config.useWorker) {
    initializeAIWorker();
  }

  performanceConfigured = true;
}

export function useAI(
  initialDifficulty: DifficultyLevel = "medium",
): UseAIReturn {
  const [difficulty, setDifficulty] =
    useState<DifficultyLevel>(initialDifficulty);
  const [isWorkerReady, setIsWorkerReady] = useState(false);

  // Configure performance on mount
  useEffect(() => {
    configurePerformance();
    setIsWorkerReady(isWorkerAvailable());
  }, []);

  const aiPlayer = useMemo(() => createAIPlayer(difficulty), [difficulty]);

  // Synchronous move (for backward compatibility)
  const getMove = useCallback(
    (state: GameState): ColumnIndex | null => {
      return aiPlayer.chooseMove(state);
    },
    [aiPlayer],
  );

  // Async move using web worker when available
  const getMoveAsync = useCallback(
    async (state: GameState): Promise<ColumnIndex | null> => {
      const config = getDifficultyConfig(difficulty);

      // Try worker first for heavy computations
      if (isWorkerAvailable() && config.depth >= 3) {
        try {
          return await getBestMoveAsync(state, config);
        } catch (error) {
          console.warn("Worker failed, falling back to main thread:", error);
        }
      }

      // Fall back to synchronous computation
      return aiPlayer.chooseMove(state);
    },
    [aiPlayer, difficulty],
  );

  const evaluateState = useCallback(
    (state: GameState): number => {
      return aiPlayer.evaluateState(state);
    },
    [aiPlayer],
  );

  const difficultyConfig = useMemo(
    () => getDifficultyConfig(difficulty),
    [difficulty],
  );

  const allDifficulties = useMemo(() => getAllDifficultyLevels(), []);

  const platformInfo = useMemo(() => getPlatformInfo(), []);

  return {
    difficulty,
    setDifficulty,
    getMove,
    getMoveAsync,
    evaluateState,
    difficultyConfig,
    allDifficulties,
    isWorkerReady,
    platformInfo,
  };
}

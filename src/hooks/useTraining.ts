"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { deepAnalysis, quickAnalysis } from "@/engine";
import type { GameState, MoveAnalysis } from "@/engine/types";
import {
  deepAnalysisAsync,
  isWorkerAvailable,
  quickAnalysisAsync,
} from "@/lib/ai-worker-manager";
import { getAIPerformanceConfig, getPlatformInfo } from "@/lib/platform";

interface UseTrainingReturn {
  isEnabled: boolean;
  toggle: () => void;
  enable: () => void;
  disable: () => void;
  analysis: MoveAnalysis[] | null;
  isAnalyzing: boolean;
  runAnalysis: (state: GameState, deep?: boolean) => void;
  clearAnalysis: () => void;
}

export function useTraining(initialEnabled = false): UseTrainingReturn {
  const [isEnabled, setIsEnabled] = useState(initialEnabled);
  const [analysis, setAnalysis] = useState<MoveAnalysis[] | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analysisTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analysisAbortRef = useRef<boolean>(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
      }
      analysisAbortRef.current = true;
    };
  }, []);

  const toggle = useCallback(() => {
    setIsEnabled((prev) => !prev);
  }, []);

  const enable = useCallback(() => {
    setIsEnabled(true);
  }, []);

  const disable = useCallback(() => {
    setIsEnabled(false);
    setAnalysis(null);
  }, []);

  const runAnalysis = useCallback(
    (state: GameState, deep = false) => {
      if (!isEnabled) return;

      // Cancel any pending analysis
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
      }
      analysisAbortRef.current = false;

      if (state.phase !== "placing") {
        setAnalysis(null);
        return;
      }

      setIsAnalyzing(true);

      // Get platform-specific simulation counts
      const performanceConfig = getAIPerformanceConfig();
      const platform = getPlatformInfo();

      // Use lower simulation counts on iOS for better responsiveness
      const quickSims = platform.isIOS
        ? Math.min(performanceConfig.monteCarloSimulations, 300)
        : 400;
      const deepSims = platform.isIOS
        ? Math.min(performanceConfig.monteCarloSimulations, 800)
        : 1500;

      // Try async worker-based analysis first for better UI responsiveness
      const runAsyncAnalysis = async () => {
        try {
          if (isWorkerAvailable()) {
            const result = deep
              ? await deepAnalysisAsync(state, deepSims)
              : await quickAnalysisAsync(state, quickSims);

            if (!analysisAbortRef.current) {
              setAnalysis(result.moves);
              setIsAnalyzing(false);
            }
            return;
          }
        } catch (error) {
          console.warn(
            "Worker analysis failed, falling back to main thread:",
            error,
          );
        }

        // Fall back to synchronous analysis with setTimeout for UI breathing room
        analysisTimeoutRef.current = setTimeout(() => {
          if (analysisAbortRef.current) return;

          const result = deep
            ? deepAnalysis(state, deepSims)
            : quickAnalysis(state, quickSims);

          if (!analysisAbortRef.current) {
            setAnalysis(result.moves);
            setIsAnalyzing(false);
          }
        }, 0);
      };

      // Start async analysis - use requestAnimationFrame for better timing
      requestAnimationFrame(() => {
        runAsyncAnalysis();
      });
    },
    [isEnabled],
  );

  const clearAnalysis = useCallback(() => {
    setAnalysis(null);
    analysisAbortRef.current = true;
    if (analysisTimeoutRef.current) {
      clearTimeout(analysisTimeoutRef.current);
    }
  }, []);

  return {
    isEnabled,
    toggle,
    enable,
    disable,
    analysis,
    isAnalyzing,
    runAnalysis,
    clearAnalysis,
  };
}

"use client";

import { useEffect, useState } from "react";
import {
  configureSimulationPerformance,
  configureSimulations,
  setMaxNodes,
} from "@/engine";
import {
  initializeAIWorker,
  isWorkerAvailable,
  terminateAIWorker,
} from "@/lib/ai-worker-manager";
import {
  type AIPerformanceConfig,
  getAIPerformanceConfig,
  getPlatformInfo,
  type PlatformInfo,
} from "@/lib/platform";

interface UsePerformanceReturn {
  /** Platform information */
  platformInfo: PlatformInfo;
  /** AI performance configuration */
  performanceConfig: AIPerformanceConfig;
  /** Whether the AI worker is ready */
  isWorkerReady: boolean;
  /** Whether performance has been initialized */
  isInitialized: boolean;
}

/** Track if performance has been globally initialized */
let globallyInitialized = false;

/**
 * Hook to initialize and manage performance optimizations
 *
 * This hook should be used in the app root to configure
 * AI and simulation performance based on the platform.
 *
 * For iOS devices, it:
 * - Reduces maximum nodes in expectimax search
 * - Lowers Monte Carlo simulation counts
 * - Initializes Web Worker for background computation
 * - Configures simulation batch sizes and yields
 *
 * @example
 * ```tsx
 * function App() {
 *   const { platformInfo, isInitialized } = usePerformance();
 *
 *   if (!isInitialized) {
 *     return <Loading />;
 *   }
 *
 *   return <Game />;
 * }
 * ```
 */
export function usePerformance(): UsePerformanceReturn {
  const [isInitialized, setIsInitialized] = useState(globallyInitialized);
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo>(() =>
    getPlatformInfo(),
  );
  const [performanceConfig, setPerformanceConfig] =
    useState<AIPerformanceConfig>(() => getAIPerformanceConfig());

  useEffect(() => {
    if (globallyInitialized) {
      setIsInitialized(true);
      setIsWorkerReady(isWorkerAvailable());
      return;
    }

    // Get platform info and performance config
    const platform = getPlatformInfo();
    const config = getAIPerformanceConfig();

    setPlatformInfo(platform);
    setPerformanceConfig(config);

    // Log platform detection
    if (process.env.NODE_ENV === "development") {
      console.log("[Performance] Platform detected:", {
        isIOS: platform.isIOS,
        isSafari: platform.isSafari,
        isMobile: platform.isMobile,
        performanceTier: platform.performanceTier,
        hardwareConcurrency: platform.hardwareConcurrency,
      });
      console.log("[Performance] Configuration:", {
        maxNodes: config.maxNodes,
        monteCarloSimulations: config.monteCarloSimulations,
        useWorker: config.useWorker,
        yieldInterval: config.yieldInterval,
        simulationBatchSize: config.simulationBatchSize,
      });
    }

    // Configure expectimax
    setMaxNodes(config.maxNodes);

    // Configure Monte Carlo simulations
    configureSimulations({
      defaultSimulations: config.monteCarloSimulations,
      quickSimulations: Math.min(config.monteCarloSimulations, 400),
      deepSimulations: Math.min(config.monteCarloSimulations * 2, 2000),
    });

    // Configure mass simulation performance
    configureSimulationPerformance({
      yieldInterval: config.yieldInterval,
      batchDelay: platform.isIOS ? 10 : 0,
      maxConcurrency: config.simulationBatchSize,
    });

    // Initialize Web Worker if supported
    if (config.useWorker) {
      try {
        initializeAIWorker();
        setIsWorkerReady(isWorkerAvailable());
      } catch (error) {
        console.warn("[Performance] Failed to initialize AI worker:", error);
      }
    }

    globallyInitialized = true;
    setIsInitialized(true);

    // Cleanup worker on unmount (only if this is the last component using it)
    return () => {
      // Don't terminate the worker on unmount as it may be used by other components
      // The worker will be terminated when the page unloads
    };
  }, []);

  return {
    platformInfo,
    performanceConfig,
    isWorkerReady,
    isInitialized,
  };
}

/**
 * Force re-initialization of performance settings
 * Useful for testing or when platform conditions change
 */
export function resetPerformanceInitialization(): void {
  globallyInitialized = false;
  terminateAIWorker();
}

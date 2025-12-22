/**
 * Platform Detection and Performance Utilities
 *
 * Detects iOS/Safari and provides platform-specific optimizations.
 * Uses WebKit-specific features when available for better performance.
 */

/** Platform detection results */
export interface PlatformInfo {
  isIOS: boolean;
  isSafari: boolean;
  isWebKit: boolean;
  isMobile: boolean;
  hardwareConcurrency: number;
  /** Estimated device performance tier: 'low' | 'medium' | 'high' */
  performanceTier: "low" | "medium" | "high";
  /** Whether the device supports Web Workers */
  supportsWorkers: boolean;
  /** Whether the device supports SharedArrayBuffer */
  supportsSharedArrayBuffer: boolean;
}

/** Cached platform info for performance */
let cachedPlatformInfo: PlatformInfo | null = null;

/**
 * Detect the current platform and its capabilities
 */
export function getPlatformInfo(): PlatformInfo {
  if (cachedPlatformInfo) {
    return cachedPlatformInfo;
  }

  // Server-side rendering fallback
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    cachedPlatformInfo = {
      isIOS: false,
      isSafari: false,
      isWebKit: false,
      isMobile: false,
      hardwareConcurrency: 4,
      performanceTier: "medium",
      supportsWorkers: false,
      supportsSharedArrayBuffer: false,
    };
    return cachedPlatformInfo;
  }

  const ua = navigator.userAgent;

  // iOS detection (iPhone, iPad, iPod)
  // Also check for iPad on iOS 13+ which reports as Mac
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  // Safari detection (not Chrome or other WebKit browsers)
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);

  // WebKit detection (Safari, iOS browsers, etc.)
  const isWebKit = /WebKit/.test(ua) && !/Edge/.test(ua);

  // Mobile detection
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
    (navigator.maxTouchPoints > 0 && /Macintosh/.test(ua));

  // Hardware concurrency with fallback
  const hardwareConcurrency = navigator.hardwareConcurrency || 4;

  // Check for Web Workers support
  const supportsWorkers = typeof Worker !== "undefined";

  // Check for SharedArrayBuffer (limited on iOS Safari)
  const supportsSharedArrayBuffer = typeof SharedArrayBuffer !== "undefined";

  // Estimate performance tier based on device characteristics
  let performanceTier: "low" | "medium" | "high" = "medium";

  if (isIOS) {
    // iOS devices have varying performance
    // Newer iPhones/iPads have good single-core performance
    // But older devices or when thermal throttled can be slow
    if (hardwareConcurrency >= 6) {
      performanceTier = "high";
    } else if (hardwareConcurrency <= 2) {
      performanceTier = "low";
    }
  } else if (isMobile) {
    // Android devices vary widely
    if (hardwareConcurrency >= 8) {
      performanceTier = "high";
    } else if (hardwareConcurrency <= 2) {
      performanceTier = "low";
    }
  } else {
    // Desktop
    if (hardwareConcurrency >= 8) {
      performanceTier = "high";
    } else if (hardwareConcurrency <= 2) {
      performanceTier = "low";
    }
  }

  cachedPlatformInfo = {
    isIOS,
    isSafari,
    isWebKit,
    isMobile,
    hardwareConcurrency,
    performanceTier,
    supportsWorkers,
    supportsSharedArrayBuffer,
  };

  return cachedPlatformInfo;
}

/**
 * Get recommended AI parameters based on platform
 */
export interface AIPerformanceConfig {
  /** Maximum nodes to explore in expectimax */
  maxNodes: number;
  /** Search depth adjustment */
  depthAdjustment: number;
  /** Monte Carlo simulations per move */
  monteCarloSimulations: number;
  /** Whether to use Web Worker for AI */
  useWorker: boolean;
  /** Yield interval for long computations (lower = more responsive) */
  yieldInterval: number;
  /** Batch size for simulations */
  simulationBatchSize: number;
}

/**
 * Get performance configuration for AI based on platform
 */
export function getAIPerformanceConfig(): AIPerformanceConfig {
  const platform = getPlatformInfo();

  // Base configuration
  const config: AIPerformanceConfig = {
    maxNodes: 500000,
    depthAdjustment: 0,
    monteCarloSimulations: 1000,
    useWorker: platform.supportsWorkers,
    yieldInterval: 3,
    simulationBatchSize: 10,
  };

  // iOS-specific optimizations
  if (platform.isIOS) {
    // iOS Safari has lower JavaScript performance and stricter power management
    // Reduce computational load to prevent UI freezing and battery drain

    if (platform.performanceTier === "low") {
      config.maxNodes = 100000;
      config.depthAdjustment = -1;
      config.monteCarloSimulations = 300;
      config.yieldInterval = 1;
      config.simulationBatchSize = 3;
    } else if (platform.performanceTier === "medium") {
      config.maxNodes = 200000;
      config.depthAdjustment = 0;
      config.monteCarloSimulations = 500;
      config.yieldInterval = 2;
      config.simulationBatchSize = 5;
    } else {
      // High performance iOS device
      config.maxNodes = 300000;
      config.monteCarloSimulations = 800;
      config.yieldInterval = 2;
      config.simulationBatchSize = 7;
    }
  } else if (platform.isMobile) {
    // Non-iOS mobile (Android)
    if (platform.performanceTier === "low") {
      config.maxNodes = 150000;
      config.depthAdjustment = -1;
      config.monteCarloSimulations = 400;
      config.yieldInterval = 1;
      config.simulationBatchSize = 4;
    } else if (platform.performanceTier === "medium") {
      config.maxNodes = 300000;
      config.monteCarloSimulations = 700;
      config.yieldInterval = 2;
      config.simulationBatchSize = 7;
    }
    // High performance keeps defaults
  }
  // Desktop keeps default high-performance settings

  return config;
}

/**
 * requestIdleCallback with fallback for Safari/iOS
 * Uses setTimeout fallback since iOS Safari doesn't support requestIdleCallback
 */
export function scheduleIdleWork(
  callback: (deadline: {
    didTimeout: boolean;
    timeRemaining: () => number;
  }) => void,
  options?: { timeout?: number },
): number {
  if (typeof window === "undefined") {
    return 0;
  }

  // Type-safe window reference
  const win = window as Window &
    typeof globalThis & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions,
      ) => number;
    };

  // Use native requestIdleCallback if available (not on Safari/iOS)
  if (win.requestIdleCallback) {
    return win.requestIdleCallback(callback, options);
  }

  // Fallback for Safari/iOS using setTimeout
  // Aim for 16ms frame budget, leaving ~4ms for other work
  const start = Date.now();
  return setTimeout(() => {
    callback({
      didTimeout: false,
      timeRemaining: () => Math.max(0, 12 - (Date.now() - start)),
    });
  }, 1) as unknown as number;
}

/**
 * Cancel scheduled idle work
 */
export function cancelIdleWork(id: number): void {
  if (typeof window === "undefined") {
    return;
  }

  // Type-safe window reference
  const win = window as Window &
    typeof globalThis & {
      cancelIdleCallback?: (id: number) => void;
    };

  if (win.cancelIdleCallback) {
    win.cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
}

/**
 * Yield to the main thread to keep UI responsive
 * Uses scheduler.yield() on modern browsers, falls back to setTimeout
 */
export function yieldToMain(): Promise<void> {
  // Check for modern scheduler.yield() API
  if (
    typeof window !== "undefined" &&
    "scheduler" in window &&
    typeof (
      window as typeof window & { scheduler?: { yield?: () => Promise<void> } }
    ).scheduler?.yield === "function"
  ) {
    return (
      window as typeof window & { scheduler: { yield: () => Promise<void> } }
    ).scheduler.yield();
  }

  // Fallback to setTimeout(0) which yields to the event loop
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Run a function in chunks to avoid blocking the main thread
 * Particularly important for iOS where long-running scripts can cause issues
 */
export async function runInChunks<T>(
  items: T[],
  processor: (item: T, index: number) => void,
  chunkSize = 50,
  onProgress?: (completed: number, total: number) => void,
): Promise<void> {
  const total = items.length;
  let completed = 0;

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);

    for (let j = 0; j < chunk.length; j++) {
      processor(chunk[j], i + j);
      completed++;
    }

    onProgress?.(completed, total);

    // Yield to main thread between chunks
    if (i + chunkSize < items.length) {
      await yieldToMain();
    }
  }
}

/**
 * Measure execution time with high precision
 * Uses performance.now() for accurate timing
 */
export function measurePerformance<T>(fn: () => T): {
  result: T;
  duration: number;
} {
  const start =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const result = fn();
  const end =
    typeof performance !== "undefined" ? performance.now() : Date.now();

  return {
    result,
    duration: end - start,
  };
}

/**
 * Create a throttled function that limits execution frequency
 * Uses requestAnimationFrame for optimal timing on iOS
 */
export function throttleWithRAF<T extends (...args: unknown[]) => unknown>(
  fn: T,
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;
  let lastArgs: Parameters<T> | null = null;

  return function throttled(...args: Parameters<T>) {
    lastArgs = args;

    if (rafId !== null) {
      return;
    }

    rafId = requestAnimationFrame(() => {
      if (lastArgs) {
        fn(...lastArgs);
      }
      rafId = null;
      lastArgs = null;
    });
  };
}

/**
 * Debounce a function with configurable delay
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function debounced(...args: Parameters<T>) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

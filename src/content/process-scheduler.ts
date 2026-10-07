export interface ProcessScheduler {
  request(): void;
  stop(): void;
}

interface ProcessSchedulerOptions {
  window: Window;
  delayMs: number;
  /**
   * Minimum spacing between run starts. A request after a quiet period still
   * runs after `delayMs`; a burst of requests coalesces into one run per window.
   */
  minIntervalMs?: number;
  task: () => Promise<void>;
  onError: (error: unknown) => void;
}

export function createProcessScheduler({
  window: win,
  delayMs,
  minIntervalMs = 0,
  task,
  onError,
}: ProcessSchedulerOptions): ProcessScheduler {
  let timeoutId: number | null = null;
  let lastRunAt = Number.NEGATIVE_INFINITY;
  let inFlight = false;
  let runAgain = false;
  let stopped = false;

  const request = (): void => {
    if (stopped) return;
    if (inFlight) {
      runAgain = true;
      return;
    }
    if (timeoutId !== null) return;
    const spacing = lastRunAt + minIntervalMs - Date.now();
    timeoutId = win.setTimeout(() => {
      timeoutId = null;
      void run();
    }, Math.max(0, delayMs, spacing));
  };

  const run = async (): Promise<void> => {
    if (stopped || inFlight) return;
    inFlight = true;
    lastRunAt = Date.now();
    try {
      await task();
    } catch (error) {
      onError(error);
    } finally {
      inFlight = false;
      if (runAgain && !stopped) {
        runAgain = false;
        request();
      }
    }
  };

  return {
    request,
    stop(): void {
      stopped = true;
      runAgain = false;
      if (timeoutId !== null) win.clearTimeout(timeoutId);
      timeoutId = null;
    },
  };
}

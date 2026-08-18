export interface ProcessScheduler {
  request(): void;
  stop(): void;
}

interface ProcessSchedulerOptions {
  window: Window;
  delayMs: number;
  task: () => Promise<void>;
  onError: (error: unknown) => void;
}

export function createProcessScheduler({
  window: win,
  delayMs,
  task,
  onError,
}: ProcessSchedulerOptions): ProcessScheduler {
  let timeoutId: number | null = null;
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
    timeoutId = win.setTimeout(() => {
      timeoutId = null;
      void run();
    }, Math.max(0, delayMs));
  };

  const run = async (): Promise<void> => {
    if (stopped || inFlight) return;
    inFlight = true;
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

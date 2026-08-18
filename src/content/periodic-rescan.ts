export const PERIODIC_RESCAN_INTERVAL_MS = 2_000;

export interface PeriodicRescanController {
  start(): void;
  stop(): void;
}

interface PeriodicRescanOptions {
  document: Document;
  window: Window;
  shouldRescan: () => boolean;
  onRescan: () => void;
  intervalMs?: number;
}

export function createPeriodicRescanController({
  document: doc,
  window: win,
  shouldRescan,
  onRescan,
  intervalMs = PERIODIC_RESCAN_INTERVAL_MS,
}: PeriodicRescanOptions): PeriodicRescanController {
  let intervalId: number | null = null;

  const requestRescan = (): void => {
    if (doc.visibilityState !== "visible" || !shouldRescan()) return;
    onRescan();
  };

  const handleVisibilityChange = (): void => {
    if (doc.visibilityState === "visible") requestRescan();
  };

  return {
    start(): void {
      if (intervalId !== null) return;
      intervalId = win.setInterval(requestRescan, Math.max(250, intervalMs));
      doc.addEventListener("visibilitychange", handleVisibilityChange);
      win.addEventListener("focus", requestRescan);
    },
    stop(): void {
      if (intervalId !== null) win.clearInterval(intervalId);
      intervalId = null;
      doc.removeEventListener("visibilitychange", handleVisibilityChange);
      win.removeEventListener("focus", requestRescan);
    },
  };
}

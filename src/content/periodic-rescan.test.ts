import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPeriodicRescanController,
  PERIODIC_RESCAN_INTERVAL_MS,
} from "./periodic-rescan";

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: state,
  });
}

describe("periodic page rescan", () => {
  afterEach(() => {
    vi.useRealTimers();
    setVisibility("visible");
  });

  it("rescans a visible active page on the interval, focus, and visibility restore", () => {
    vi.useFakeTimers();
    setVisibility("visible");
    let enabled = true;
    const onRescan = vi.fn();
    const controller = createPeriodicRescanController({
      document,
      window,
      shouldRescan: () => enabled,
      onRescan,
    });

    controller.start();
    controller.start();
    vi.advanceTimersByTime(PERIODIC_RESCAN_INTERVAL_MS);
    expect(onRescan).toHaveBeenCalledTimes(1);

    enabled = false;
    vi.advanceTimersByTime(PERIODIC_RESCAN_INTERVAL_MS);
    window.dispatchEvent(new Event("focus"));
    expect(onRescan).toHaveBeenCalledTimes(1);

    enabled = true;
    setVisibility("hidden");
    vi.advanceTimersByTime(PERIODIC_RESCAN_INTERVAL_MS);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(onRescan).toHaveBeenCalledTimes(1);

    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
    expect(onRescan).toHaveBeenCalledTimes(3);

    controller.stop();
    vi.advanceTimersByTime(PERIODIC_RESCAN_INTERVAL_MS * 2);
    window.dispatchEvent(new Event("focus"));
    expect(onRescan).toHaveBeenCalledTimes(3);
  });
});

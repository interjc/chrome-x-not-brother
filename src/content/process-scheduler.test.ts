import { afterEach, describe, expect, it, vi } from "vitest";
import { createProcessScheduler } from "./process-scheduler";

describe("content process scheduler", () => {
  afterEach(() => vi.useRealTimers());

  it("debounces pending work and serializes overlapping requests into one follow-up", async () => {
    vi.useFakeTimers();
    const resolvers: Array<() => void> = [];
    const task = vi.fn(() => new Promise<void>((resolve) => resolvers.push(resolve)));
    const onError = vi.fn();
    const scheduler = createProcessScheduler({ window, delayMs: 180, task, onError });

    scheduler.request();
    scheduler.request();
    await vi.advanceTimersByTimeAsync(180);
    expect(task).toHaveBeenCalledTimes(1);

    scheduler.request();
    scheduler.request();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(task).toHaveBeenCalledTimes(1);

    resolvers.shift()?.();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(180);
    expect(task).toHaveBeenCalledTimes(2);
    expect(onError).not.toHaveBeenCalled();

    scheduler.stop();
    resolvers.shift()?.();
    scheduler.request();
    await vi.runAllTimersAsync();
    expect(task).toHaveBeenCalledTimes(2);
  });

  it("reports task failures without starting concurrent work", async () => {
    vi.useFakeTimers();
    const failure = new Error("scan failed");
    const task = vi.fn().mockRejectedValue(failure);
    const onError = vi.fn();
    const scheduler = createProcessScheduler({ window, delayMs: 0, task, onError });

    scheduler.request();
    await vi.runAllTimersAsync();

    expect(task).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(failure);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isTransientRuntimeMessageError,
  sendRuntimeMessage,
} from "./runtime-message";

afterEach(() => vi.unstubAllGlobals());

function chromeWithSendMessage(
  sendMessage: (...args: unknown[]) => unknown,
): void {
  vi.stubGlobal("chrome", {
    runtime: { id: "extension-id", sendMessage },
    storage: { local: {}, sync: {} },
  });
}

describe("transient runtime messages", () => {
  it("retries a closed asynchronous message channel and then succeeds", async () => {
    const sendMessage = vi.fn()
      .mockRejectedValueOnce(new Error(
        "A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received",
      ))
      .mockResolvedValueOnce({ ok: true, summary: { total: 1 } });
    chromeWithSendMessage(sendMessage);
    const sleep = vi.fn(async () => undefined);

    await expect(sendRuntimeMessage(
      { type: "summary:get" },
      { sleep },
    )).resolves.toEqual({ ok: true, summary: { total: 1 } });
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledOnce();
  });

  it("retries receiving-end-does-not-exist while the service worker starts", async () => {
    const sendMessage = vi.fn()
      .mockRejectedValueOnce(new Error("Could not establish connection. Receiving end does not exist."))
      .mockRejectedValueOnce(new Error("The message port closed before a response was received."))
      .mockResolvedValueOnce({ ok: true });
    chromeWithSendMessage(sendMessage);

    await expect(sendRuntimeMessage(
      { type: "users:lookup", userKeys: ["alice"] },
      { sleep: async () => undefined },
    )).resolves.toEqual({ ok: true });
    expect(sendMessage).toHaveBeenCalledTimes(3);
  });

  it("gives up after the retry budget", async () => {
    const error = new Error("The message port closed before a response was received.");
    const sendMessage = vi.fn().mockRejectedValue(error);
    chromeWithSendMessage(sendMessage);

    await expect(sendRuntimeMessage(
      { type: "summary:get" },
      { retries: 2, sleep: async () => undefined },
    )).rejects.toBe(error);
    expect(sendMessage).toHaveBeenCalledTimes(3);
  });

  it("does not retry extension-context invalidation", async () => {
    const sendMessage = vi.fn().mockRejectedValue(
      new Error("Extension context invalidated."),
    );
    chromeWithSendMessage(sendMessage);
    const sleep = vi.fn(async () => undefined);

    await expect(sendRuntimeMessage({ type: "summary:get" }, { sleep }))
      .rejects.toThrow(/extension context invalidated/i);
    expect(sendMessage).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });

  it("classifies only wakeup and closed-port failures as transient", () => {
    chromeWithSendMessage(vi.fn());
    expect(isTransientRuntimeMessageError(new Error(
      "A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received",
    ))).toBe(true);
    expect(isTransientRuntimeMessageError(new Error("Unexpected response"))).toBe(false);
  });
});

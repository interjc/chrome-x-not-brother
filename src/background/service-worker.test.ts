import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../storage/database", () => ({
  deleteUserRecord: vi.fn(async () => undefined),
  getObservationSummary: vi.fn(async () => ({})),
  getUserRecords: vi.fn(async () => []),
  purgeUnknownObservations: vi.fn(async () => undefined),
  upsertObservations: vi.fn(async () => []),
}));

type Listener = (...args: never[]) => unknown;

function listenerSlot() {
  const slot: { current?: Listener } = {};
  return {
    slot,
    event: { addListener: vi.fn((listener: Listener) => { slot.current = listener; }) },
  };
}

// A Safari-shaped host: no sidePanel, no badge text color, no getContexts.
function stubSafariChrome() {
  const message = listenerSlot();
  const menuClick = listenerSlot();
  const host = {
    runtime: {
      onInstalled: { addListener: vi.fn() },
      onMessage: message.event,
      getURL: (path: string) => `safari-web-extension://id/${path}`,
      lastError: undefined,
    },
    storage: {
      sync: { get: vi.fn(async () => ({})), set: vi.fn(async () => undefined) },
      local: {
        get: vi.fn(async () => ({})),
        set: vi.fn(async () => undefined),
        remove: vi.fn(async () => undefined),
      },
      onChanged: { addListener: vi.fn() },
    },
    action: {
      setBadgeText: vi.fn(async () => undefined),
      setBadgeBackgroundColor: vi.fn(async () => undefined),
      setTitle: vi.fn(async () => undefined),
    },
    contextMenus: {
      onClicked: menuClick.event,
      update: vi.fn(async () => undefined),
      create: vi.fn(),
    },
    tabs: {
      create: vi.fn(async () => ({})),
      query: vi.fn(async () => []),
      sendMessage: vi.fn(async () => undefined),
    },
  };
  vi.stubGlobal("chrome", host);
  return { host, onMessage: message.slot, onMenuClick: menuClick.slot };
}

describe("service worker on hosts without a side panel", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads, answers side panel requests with a fallback, and opens the dashboard from the menu", async () => {
    const { host, onMessage, onMenuClick } = stubSafariChrome();
    await expect(import("./service-worker")).resolves.toBeDefined();
    await vi.waitFor(() => expect(host.action.setBadgeText).toHaveBeenCalled());

    const sendResponse = vi.fn();
    const keepOpen = onMessage.current!(
      { type: "sidepanel:open", toggle: true } as never,
      { url: "https://x.com/home", tab: { id: 3, windowId: 1 } } as never,
      sendResponse as never,
    );
    expect(keepOpen).toBe(false);
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));

    onMenuClick.current!(
      { menuItemId: "not-brother-review-consent" } as never,
      { windowId: 1 } as never,
    );
    await vi.waitFor(() => expect(host.tabs.create).toHaveBeenCalledWith({
      url: "safari-web-extension://id/dashboard.html",
    }));
  });
});

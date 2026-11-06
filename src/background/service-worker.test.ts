import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../storage/database", () => ({
  deleteUserRecord: vi.fn(async () => undefined),
  getObservationSummary: vi.fn(async () => ({})),
  getUserRecords: vi.fn(async () => []),
  purgeUnknownObservations: vi.fn(async () => undefined),
  upsertObservations: vi.fn(async () => []),
  claimLegacyArchive: vi.fn(async () => 0),
  deleteHandleEverywhere: vi.fn(async () => undefined),
  db: {},
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

describe("service worker observation writes after an account switch", () => {
  const SETTINGS_KEY = "notBrother.settings.v1";
  const LOCAL_SETTINGS_KEY = "notBrother.settings.local.v1";

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // The previous account, @alpha, is still the last-known viewer in settings.
  function stubAfterSwitch(observerEnabled: boolean) {
    const { host, onMessage } = stubSafariChrome();
    const areas: Record<"sync" | "local", Record<string, unknown>> = {
      sync: { [SETTINGS_KEY]: { consentVersion: 3, observerEnabled } },
      local: { [LOCAL_SETTINGS_KEY]: { viewerHandle: "alpha", knownViewerHandles: ["alpha"] } },
    };
    for (const name of ["sync", "local"] as const) {
      Object.assign(host.storage[name], {
        get: vi.fn(async (keys: string | string[]) => {
          const wanted = Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(
            wanted.filter((key) => key in areas[name]).map((key) => [key, areas[name][key]]),
          );
        }),
        set: vi.fn(async (items: Record<string, unknown>) => {
          Object.assign(areas[name], items);
        }),
      });
    }
    return { onMessage, areas };
  }

  async function upsert(
    onMessage: { current?: Listener },
    viewerHandle: string | null,
  ): Promise<unknown> {
    const sendResponse = vi.fn();
    onMessage.current!(
      {
        type: "observations:upsert",
        viewerHandle,
        observations: [{
          userKey: "carol",
          handle: "carol",
          displayName: null,
          avatarUrl: null,
          profileUrl: "https://x.com/carol",
          observedAt: 1,
          sourceUrl: "https://x.com/home",
          sourceType: "timeline",
          relationship: "mutual",
          evidence: [],
        }],
      } as never,
      { url: "https://x.com/home" } as never,
      sendResponse as never,
    );
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());
    return sendResponse.mock.calls[0]?.[0];
  }

  it("drops observations from a page that shows no signed-in account", async () => {
    const { onMessage } = stubAfterSwitch(true);
    await import("./service-worker");
    const database = await import("../storage/database");

    await expect(upsert(onMessage, null)).resolves.toEqual({ ok: true, users: [] });
    expect(database.upsertObservations).not.toHaveBeenCalled();
  });

  it("writes into the account the page shows, not the last-known one", async () => {
    const { onMessage, areas } = stubAfterSwitch(true);
    await import("./service-worker");
    const database = await import("../storage/database");

    await upsert(onMessage, "Bravo");
    expect(database.upsertObservations).toHaveBeenCalledWith("bravo", expect.any(Array));
    expect(areas.local[LOCAL_SETTINGS_KEY]).toMatchObject({ viewerHandle: "bravo" });
  });

  it("follows the switch while the observer is paused without writing observations", async () => {
    const { onMessage, areas } = stubAfterSwitch(false);
    await import("./service-worker");
    const database = await import("../storage/database");

    await expect(upsert(onMessage, "bravo")).resolves.toEqual({ ok: true, users: [] });
    expect(database.upsertObservations).not.toHaveBeenCalled();
    expect(areas.local[LOCAL_SETTINGS_KEY]).toMatchObject({
      viewerHandle: "bravo",
      knownViewerHandles: ["alpha", "bravo"],
    });
  });
});

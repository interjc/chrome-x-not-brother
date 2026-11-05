import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ObservationDraft } from "../domain/types";
import { LEGACY_CLAIM_KEY, adoptViewer, getLegacyClaim, ownAccounts, resolveViewer } from "./account-archive";
import { LEGACY_VIEWER, NotBrotherDatabase, getArchiveUsers, listArchiveScopes, upsertObservations } from "./database";
import { LOCAL_SETTINGS_KEY, getSettings } from "./settings";

function storageArea(): chrome.storage.StorageArea {
  const items = new Map<string, unknown>();
  return {
    get: vi.fn(async (keys: string | string[]) => {
      const list = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(list.filter((key) => items.has(key)).map((key) => [key, items.get(key)]));
    }),
    set: vi.fn(async (values: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(values)) items.set(key, structuredClone(value));
    }),
    remove: vi.fn(async (key: string) => {
      items.delete(key);
    }),
  } as unknown as chrome.storage.StorageArea;
}

function observation(key: string): ObservationDraft {
  return {
    userKey: key,
    handle: key,
    displayName: null,
    avatarUrl: null,
    profileUrl: `https://x.com/${key}`,
    observedAt: 2_000,
    sourceUrl: "https://x.com/home",
    sourceType: "timeline",
    relationship: "mutual",
    evidence: ["following-control"],
  };
}

let database: NotBrotherDatabase;
let local: chrome.storage.StorageArea;

beforeEach(() => {
  local = storageArea();
  vi.stubGlobal("chrome", { storage: { sync: storageArea(), local } });
  database = new NotBrotherDatabase(`account-archive-test-${Math.random()}`);
});

afterEach(async () => {
  database.close();
  await Dexie.delete(database.name);
  vi.unstubAllGlobals();
});

describe("resolveViewer", () => {
  it("prefers the message account and normalizes it", () => {
    expect(resolveViewer("@Alpha", { viewerHandle: "beta" })).toBe("alpha");
    expect(resolveViewer(null, { viewerHandle: "beta" })).toBe("beta");
    expect(resolveViewer("not a handle!", { viewerHandle: null })).toBeNull();
    expect(ownAccounts({ knownViewerHandles: ["a"] }, "b")).toEqual(["a", "b"]);
  });
});

describe("adoptViewer", () => {
  it("hands the 0.5.x archive to the first account and records a one-time notice", async () => {
    await upsertObservations(LEGACY_VIEWER, [observation("carol"), observation("beta")], database);

    const settings = await adoptViewer("alpha", database);
    expect(settings).toMatchObject({ viewerHandle: "alpha", knownViewerHandles: ["alpha"] });
    expect(await listArchiveScopes(database)).toEqual([{ viewer: "alpha", userCount: 2 }]);
    expect(await getLegacyClaim()).toMatchObject({ viewer: "alpha", userCount: 2, dismissed: false });
  });

  it("removes a newly seen own account from every archive and remembers it", async () => {
    await adoptViewer("alpha", database);
    await upsertObservations("alpha", [observation("beta"), observation("carol")], database);

    const settings = await adoptViewer("beta", database);
    expect(settings.knownViewerHandles).toEqual(["alpha", "beta"]);
    expect(settings.viewerHandle).toBe("beta");
    expect((await getArchiveUsers("alpha", [], database)).map((user) => user.key)).toEqual(["carol"]);
    expect((await getSettings()).knownViewerHandles).toEqual(["alpha", "beta"]);
    expect(await local.get(LOCAL_SETTINGS_KEY)).toMatchObject({
      [LOCAL_SETTINGS_KEY]: { viewerHandle: "beta", knownViewerHandles: ["alpha", "beta"] },
    });
    expect(await local.get(LEGACY_CLAIM_KEY)).toEqual({});
  });
});

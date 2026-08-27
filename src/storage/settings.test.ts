import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CURRENT_CONSENT_VERSION,
  DEFAULT_SETTINGS,
  LOCAL_SETTINGS_KEY,
  SETTINGS_KEY,
  getSettings,
  isSettingsStorageChange,
  updateSettings,
} from "./settings";

describe("observer settings", () => {
  const localStorage = new Map<string, unknown>();
  const syncStorage = new Map<string, unknown>();

  function storageArea(storage: Map<string, unknown>) {
    return {
      get: vi.fn(async (keys: string | string[]) => {
        const requested = Array.isArray(keys) ? keys : [keys];
        return Object.fromEntries(
          requested
            .filter((key) => storage.has(key))
            .map((key) => [key, storage.get(key)]),
        );
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        for (const [key, value] of Object.entries(items)) storage.set(key, value);
      }),
      remove: vi.fn(async (keys: string | string[]) => {
        for (const key of Array.isArray(keys) ? keys : [keys]) storage.delete(key);
      }),
    };
  }

  beforeEach(() => {
    localStorage.clear();
    syncStorage.clear();
    vi.stubGlobal("chrome", {
      storage: {
        local: storageArea(localStorage),
        sync: {
          ...storageArea(syncStorage),
          QUOTA_BYTES_PER_ITEM: 8_192,
        },
      },
    });
  });

  it("starts without consent and with observation disabled", async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.consentVersion).toBe(0);
    expect(DEFAULT_SETTINGS.observerEnabled).toBe(false);
    expect(DEFAULT_SETTINGS.dockCollapsed).toBe(false);
    expect(DEFAULT_SETTINGS.uiLocale).toBe("auto");
    expect(DEFAULT_SETTINGS.hideMutedAccounts).toBe(false);
    expect(DEFAULT_SETTINGS.hideBlockedByAccounts).toBe(false);
    expect(DEFAULT_SETTINGS.hideByFilterRules).toBe(false);
    expect(DEFAULT_SETTINGS.sidePanelTab).toBe("status");
  });

  it("persists affirmative consent and observation atomically in sync storage", async () => {
    const settings = await updateSettings({
      consentVersion: CURRENT_CONSENT_VERSION,
      observerEnabled: true,
    });

    expect(settings.consentVersion).toBe(CURRENT_CONSENT_VERSION);
    expect(settings.observerEnabled).toBe(true);
    expect(syncStorage.get(SETTINGS_KEY)).toEqual({
      consentVersion: CURRENT_CONSENT_VERSION,
      observerEnabled: true,
      showBadges: true,
      dockCollapsed: false,
      uiLocale: "auto",
      hideMutedAccounts: false,
      hideBlockedByAccounts: false,
      hideByFilterRules: false,
      sidePanelTab: "status",
    });
  });

  it("migrates legacy local preferences to sync and keeps the viewer local", async () => {
    localStorage.set(SETTINGS_KEY, {
      ...DEFAULT_SETTINGS,
      consentVersion: 1,
      observerEnabled: true,
      viewerHandle: "interjc",
      uiLocale: "ja",
    });

    expect(await getSettings()).toMatchObject({
      consentVersion: 1,
      observerEnabled: true,
      viewerHandle: "interjc",
      uiLocale: "ja",
    });
    expect(syncStorage.get(SETTINGS_KEY)).toMatchObject({
      consentVersion: 1,
      observerEnabled: true,
      uiLocale: "ja",
    });
    expect(syncStorage.get(SETTINGS_KEY)).not.toHaveProperty("viewerHandle");
    expect(localStorage.get(LOCAL_SETTINGS_KEY)).toEqual({ viewerHandle: "interjc" });
    expect(localStorage.has(SETTINGS_KEY)).toBe(false);
  });

  it("does not overwrite existing sync preferences during legacy migration", async () => {
    const synced: Record<string, unknown> = {
      consentVersion: CURRENT_CONSENT_VERSION,
      observerEnabled: false,
      showBadges: true,
      dockCollapsed: false,
      uiLocale: "zh-CN",
      hideMutedAccounts: false,
      hideBlockedByAccounts: false,
      hideByFilterRules: false,
      sidePanelTab: "status",
    };
    syncStorage.set(SETTINGS_KEY, synced);
    localStorage.set(SETTINGS_KEY, {
      ...DEFAULT_SETTINGS,
      consentVersion: 1,
      observerEnabled: true,
      viewerHandle: "local-viewer",
      uiLocale: "ja",
    });

    expect(await getSettings()).toMatchObject({
      consentVersion: CURRENT_CONSENT_VERSION,
      observerEnabled: false,
      viewerHandle: "local-viewer",
      uiLocale: "zh-CN",
    });
    expect(syncStorage.get(SETTINGS_KEY)).toEqual(synced);
    expect(localStorage.get(LOCAL_SETTINGS_KEY)).toEqual({ viewerHandle: "local-viewer" });
    expect(localStorage.has(SETTINGS_KEY)).toBe(false);
  });

  it("keeps the legacy local value when migration cannot write sync storage", async () => {
    const legacy = {
      ...DEFAULT_SETTINGS,
      consentVersion: 1,
      observerEnabled: true,
      viewerHandle: "local-viewer",
    };
    localStorage.set(SETTINGS_KEY, legacy);
    vi.mocked(chrome.storage.sync.set).mockRejectedValueOnce(new Error("sync quota exceeded"));

    await expect(getSettings()).rejects.toThrow("sync quota exceeded");
    expect(localStorage.get(SETTINGS_KEY)).toEqual(legacy);
    expect(localStorage.has(LOCAL_SETTINGS_KEY)).toBe(false);
  });

  it("keeps a newly detected viewer handle out of sync storage", async () => {
    const settings = await updateSettings({ viewerHandle: "interjc" });

    expect(settings.viewerHandle).toBe("interjc");
    expect(localStorage.get(LOCAL_SETTINGS_KEY)).toEqual({ viewerHandle: "interjc" });
    expect(syncStorage.has(SETTINGS_KEY)).toBe(false);
  });

  it("fills new fields when reading older partial sync settings", async () => {
    syncStorage.set(SETTINGS_KEY, { showBadges: false, collectUnknown: true });

    expect(await getSettings()).toEqual({
      ...DEFAULT_SETTINGS,
      showBadges: false,
    });
  });

  it("persists the observer dock presentation preference", async () => {
    const settings = await updateSettings({ dockCollapsed: true });

    expect(settings.dockCollapsed).toBe(true);
    expect(await getSettings()).toEqual(settings);
  });

  it("defaults missing UI language preference to follow the browser", async () => {
    syncStorage.set(SETTINGS_KEY, { consentVersion: 1, observerEnabled: true });

    expect(await getSettings()).toMatchObject({
      consentVersion: 1,
      observerEnabled: true,
      uiLocale: "auto",
    });
  });

  it("persists a manual UI language and rejects unknown values", async () => {
    const settings = await updateSettings({ uiLocale: "ja" });
    expect(settings.uiLocale).toBe("ja");

    syncStorage.set(SETTINGS_KEY, { ...settings, viewerHandle: undefined, uiLocale: "fr" });
    expect(await getSettings()).toMatchObject({ uiLocale: "auto" });
  });

  it("persists optional timeline filters without turning them on for older settings", async () => {
    const settings = await updateSettings({ hideMutedAccounts: true });
    expect(settings.hideMutedAccounts).toBe(true);
    expect(settings.hideBlockedByAccounts).toBe(false);
    expect(settings.hideByFilterRules).toBe(false);

    syncStorage.set(SETTINGS_KEY, { consentVersion: 1, observerEnabled: true });
    expect(await getSettings()).toMatchObject({
      hideMutedAccounts: false,
      hideBlockedByAccounts: false,
      hideByFilterRules: false,
    });
  });

  it("persists the side panel tab and rejects unknown values", async () => {
    const settings = await updateSettings({ sidePanelTab: "options" });
    expect(settings.sidePanelTab).toBe("options");

    syncStorage.set(SETTINGS_KEY, {
      ...settings,
      viewerHandle: undefined,
      sidePanelTab: "archive",
    });
    expect(await getSettings()).toMatchObject({ sidePanelTab: "status" });
  });

  it("keeps the synced settings item below Chrome's per-item quota", async () => {
    await updateSettings({
      consentVersion: CURRENT_CONSENT_VERSION,
      observerEnabled: true,
      uiLocale: "zh-CN",
    });
    const stored = syncStorage.get(SETTINGS_KEY);
    const bytes = new TextEncoder().encode(SETTINGS_KEY + JSON.stringify(stored)).byteLength;

    expect(bytes).toBeLessThan(chrome.storage.sync.QUOTA_BYTES_PER_ITEM);
  });

  it("recognizes both synced preference and local viewer changes", () => {
    expect(isSettingsStorageChange({
      [SETTINGS_KEY]: { newValue: DEFAULT_SETTINGS },
    }, "sync")).toBe(true);
    expect(isSettingsStorageChange({
      [LOCAL_SETTINGS_KEY]: { newValue: { viewerHandle: "interjc" } },
    }, "local")).toBe(true);
    expect(isSettingsStorageChange({ other: { newValue: true } }, "local")).toBe(false);
  });

  it("reports an invalidated extension context without dereferencing storage areas", async () => {
    vi.stubGlobal("chrome", {});

    await expect(getSettings()).rejects.toThrow("Extension context invalidated");
  });
});

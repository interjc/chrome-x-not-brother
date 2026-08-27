import {
  SIDE_PANEL_TABS,
  UI_LOCALE_PREFERENCES,
  type ObserverSettings,
  type SidePanelTab,
  type UiLocalePreference,
} from "../domain/types";

export const SETTINGS_KEY = "notBrother.settings.v1";
export const LOCAL_SETTINGS_KEY = "notBrother.settings.local.v1";
export const CURRENT_CONSENT_VERSION = 3;

export const DEFAULT_SETTINGS: ObserverSettings = {
  consentVersion: 0,
  observerEnabled: false,
  showBadges: true,
  dockCollapsed: false,
  viewerHandle: null,
  uiLocale: "auto",
  hideMutedAccounts: false,
  hideBlockedByAccounts: false,
  hideByFilterRules: false,
  sidePanelTab: "status",
};

export function uiLocalePreference(value: unknown): UiLocalePreference {
  return typeof value === "string" &&
    (UI_LOCALE_PREFERENCES as readonly string[]).includes(value)
    ? value as UiLocalePreference
    : DEFAULT_SETTINGS.uiLocale;
}

export function sidePanelTabPreference(value: unknown): SidePanelTab {
  return typeof value === "string" &&
    (SIDE_PANEL_TABS as readonly string[]).includes(value)
    ? value as SidePanelTab
    : DEFAULT_SETTINGS.sidePanelTab;
}

export function coerceSettings(
  saved?: Partial<ObserverSettings> | null,
): ObserverSettings {
  return {
    consentVersion: saved?.consentVersion ?? DEFAULT_SETTINGS.consentVersion,
    observerEnabled: saved?.observerEnabled ?? DEFAULT_SETTINGS.observerEnabled,
    showBadges: saved?.showBadges ?? DEFAULT_SETTINGS.showBadges,
    dockCollapsed: saved?.dockCollapsed ?? DEFAULT_SETTINGS.dockCollapsed,
    viewerHandle: saved?.viewerHandle ?? DEFAULT_SETTINGS.viewerHandle,
    uiLocale: uiLocalePreference(saved?.uiLocale),
    hideMutedAccounts: saved?.hideMutedAccounts ?? DEFAULT_SETTINGS.hideMutedAccounts,
    hideBlockedByAccounts:
      saved?.hideBlockedByAccounts ?? DEFAULT_SETTINGS.hideBlockedByAccounts,
    hideByFilterRules: saved?.hideByFilterRules ?? DEFAULT_SETTINGS.hideByFilterRules,
    sidePanelTab: sidePanelTabPreference(saved?.sidePanelTab),
  };
}

type SyncedObserverSettings = Omit<ObserverSettings, "viewerHandle">;
type LocalObserverSettings = Pick<ObserverSettings, "viewerHandle">;

const SYNCED_SETTING_KEYS = [
  "consentVersion",
  "observerEnabled",
  "showBadges",
  "dockCollapsed",
  "uiLocale",
  "hideMutedAccounts",
  "hideBlockedByAccounts",
  "hideByFilterRules",
  "sidePanelTab",
] as const satisfies readonly (keyof SyncedObserverSettings)[];

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function storedSettings(value: unknown): Partial<ObserverSettings> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Partial<ObserverSettings>
    : undefined;
}

function syncedSettings(settings: ObserverSettings): SyncedObserverSettings {
  return {
    consentVersion: settings.consentVersion,
    observerEnabled: settings.observerEnabled,
    showBadges: settings.showBadges,
    dockCollapsed: settings.dockCollapsed,
    uiLocale: settings.uiLocale,
    hideMutedAccounts: settings.hideMutedAccounts,
    hideBlockedByAccounts: settings.hideBlockedByAccounts,
    hideByFilterRules: settings.hideByFilterRules,
    sidePanelTab: settings.sidePanelTab,
  };
}

function settingsStorageAreas(): {
  sync: chrome.storage.StorageArea;
  local: chrome.storage.StorageArea;
} {
  if (
    typeof chrome === "undefined" ||
    !chrome.storage?.sync ||
    !chrome.storage?.local
  ) {
    throw new Error("Extension context invalidated.");
  }
  return { sync: chrome.storage.sync, local: chrome.storage.local };
}

export function isSettingsStorageChange(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
): boolean {
  return (areaName === "sync" && hasOwn(changes, SETTINGS_KEY)) ||
    (areaName === "local" && (
      hasOwn(changes, LOCAL_SETTINGS_KEY) ||
      hasOwn(changes, SETTINGS_KEY)
    ));
}

export async function getSettings(): Promise<ObserverSettings> {
  const storage = settingsStorageAreas();
  const [syncedItems, localItems] = await Promise.all([
    storage.sync.get(SETTINGS_KEY),
    storage.local.get([SETTINGS_KEY, LOCAL_SETTINGS_KEY]),
  ]);
  const savedSynced = storedSettings(syncedItems[SETTINGS_KEY]);
  const savedLocal = storedSettings(localItems[LOCAL_SETTINGS_KEY]) as
    | Partial<LocalObserverSettings>
    | undefined;
  const legacyLocal = storedSettings(localItems[SETTINGS_KEY]);
  const hasLocalViewer = Boolean(savedLocal && hasOwn(savedLocal, "viewerHandle"));
  const viewerHandle = hasLocalViewer
    ? savedLocal?.viewerHandle
    : legacyLocal?.viewerHandle;
  const next = coerceSettings({
    ...(savedSynced ?? legacyLocal),
    viewerHandle: viewerHandle ?? DEFAULT_SETTINGS.viewerHandle,
  });

  if (legacyLocal) {
    if (!savedSynced) {
      await storage.sync.set({ [SETTINGS_KEY]: syncedSettings(next) });
    }
    if (!hasLocalViewer && hasOwn(legacyLocal, "viewerHandle")) {
      await storage.local.set({
        [LOCAL_SETTINGS_KEY]: { viewerHandle: next.viewerHandle } satisfies LocalObserverSettings,
      });
    }
    await storage.local.remove(SETTINGS_KEY);
  }

  return next;
}

export async function updateSettings(
  patch: Partial<ObserverSettings>,
): Promise<ObserverSettings> {
  const storage = settingsStorageAreas();
  const next = coerceSettings({ ...(await getSettings()), ...patch });
  const writes: Promise<void>[] = [];

  if (SYNCED_SETTING_KEYS.some((key) => hasOwn(patch, key))) {
    writes.push(storage.sync.set({ [SETTINGS_KEY]: syncedSettings(next) }));
  }
  if (hasOwn(patch, "viewerHandle")) {
    writes.push(storage.local.set({
      [LOCAL_SETTINGS_KEY]: { viewerHandle: next.viewerHandle } satisfies LocalObserverSettings,
    }));
  }

  await Promise.all(writes);
  return next;
}

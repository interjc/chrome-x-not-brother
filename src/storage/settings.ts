import {
  SIDE_PANEL_TABS,
  UI_LOCALE_PREFERENCES,
  type ObserverSettings,
  type SidePanelTab,
  type UiLocalePreference,
} from "../domain/types";

export const SETTINGS_KEY = "notBrother.settings.v1";
export const CURRENT_CONSENT_VERSION = 1;

export const DEFAULT_SETTINGS: ObserverSettings = {
  consentVersion: 0,
  observerEnabled: false,
  showBadges: true,
  dockCollapsed: false,
  viewerHandle: null,
  uiLocale: "auto",
  hideMutedAccounts: false,
  hideBlockedByAccounts: false,
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
    sidePanelTab: sidePanelTabPreference(saved?.sidePanelTab),
  };
}

function localStorageArea(): chrome.storage.StorageArea {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    throw new Error("Extension context invalidated.");
  }
  return chrome.storage.local;
}

export async function getSettings(): Promise<ObserverSettings> {
  const stored = await localStorageArea().get(SETTINGS_KEY);
  return coerceSettings(stored[SETTINGS_KEY] as Partial<ObserverSettings> | undefined);
}

export async function updateSettings(
  patch: Partial<ObserverSettings>,
): Promise<ObserverSettings> {
  const next = { ...(await getSettings()), ...patch };
  await localStorageArea().set({ [SETTINGS_KEY]: next });
  return next;
}

import type { ObserverSettings } from "../domain/types";

export const SETTINGS_KEY = "notBrother.settings.v1";
export const CURRENT_CONSENT_VERSION = 1;

export const DEFAULT_SETTINGS: ObserverSettings = {
  consentVersion: 0,
  observerEnabled: false,
  showBadges: true,
  dockCollapsed: false,
  viewerHandle: null,
};

function localStorageArea(): chrome.storage.StorageArea {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    throw new Error("Extension context invalidated.");
  }
  return chrome.storage.local;
}

export async function getSettings(): Promise<ObserverSettings> {
  const stored = await localStorageArea().get(SETTINGS_KEY);
  const saved = stored[SETTINGS_KEY] as Partial<ObserverSettings> | undefined;
  return {
    consentVersion: saved?.consentVersion ?? DEFAULT_SETTINGS.consentVersion,
    observerEnabled: saved?.observerEnabled ?? DEFAULT_SETTINGS.observerEnabled,
    showBadges: saved?.showBadges ?? DEFAULT_SETTINGS.showBadges,
    dockCollapsed: saved?.dockCollapsed ?? DEFAULT_SETTINGS.dockCollapsed,
    viewerHandle: saved?.viewerHandle ?? DEFAULT_SETTINGS.viewerHandle,
  };
}

export async function updateSettings(
  patch: Partial<ObserverSettings>,
): Promise<ObserverSettings> {
  const next = { ...(await getSettings()), ...patch };
  await localStorageArea().set({ [SETTINGS_KEY]: next });
  return next;
}

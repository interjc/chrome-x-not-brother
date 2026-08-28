import {
  addHideStats,
  coerceHideStats,
  type HideStats,
  type HideStatsDelta,
} from "../domain/hide-stats";
import { normalizeViewerNamespace } from "./filter-rule-keys";

export const HIDE_STATS_KEY = "notBrother.hideStats.v1";
export const HIDE_STATS_NAMESPACE_PREFIX = "notBrother.hideStats.v1.ns.";

export function hideStatsStorageKey(viewerHandle: string | null | undefined): string {
  const namespace = normalizeViewerNamespace(viewerHandle);
  return namespace ? `${HIDE_STATS_NAMESPACE_PREFIX}${namespace}` : HIDE_STATS_KEY;
}

export function isHideStatsStorageKey(key: string): boolean {
  return key === HIDE_STATS_KEY || key.startsWith(HIDE_STATS_NAMESPACE_PREFIX);
}

export function isHideStatsStorageChange(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
  viewerHandle?: string | null,
): boolean {
  if (areaName !== "local") return false;
  if (viewerHandle !== undefined) {
    return Object.prototype.hasOwnProperty.call(changes, hideStatsStorageKey(viewerHandle));
  }
  return Object.keys(changes).some(isHideStatsStorageKey);
}

function localStorageArea(): chrome.storage.StorageArea {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    throw new Error("Extension context invalidated.");
  }
  return chrome.storage.local;
}

export async function getHideStats(
  viewerHandle?: string | null,
): Promise<HideStats> {
  const key = hideStatsStorageKey(viewerHandle);
  const items = await localStorageArea().get(key);
  return coerceHideStats(items[key]);
}

export async function incrementHideStats(
  delta: HideStatsDelta,
  viewerHandle?: string | null,
): Promise<HideStats> {
  const current = await getHideStats(viewerHandle);
  const next = addHideStats(current, delta);
  await localStorageArea().set({ [hideStatsStorageKey(viewerHandle)]: next });
  return next;
}

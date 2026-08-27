export const FILTER_RULES_KEY = "notBrother.filterRules.v1";
export const FILTER_RULES_NAMESPACE_PREFIX = "notBrother.filterRules.v1.ns.";

const VIEWER_NAMESPACE_PATTERN = /^[a-z0-9_]{1,15}$/;

export function normalizeViewerNamespace(
  handle: string | null | undefined,
): string | null {
  const value = handle?.trim().replace(/^@/, "").toLowerCase() ?? "";
  return VIEWER_NAMESPACE_PATTERN.test(value) ? value : null;
}

export function filterRulesStorageKey(viewerHandle: string | null | undefined): string {
  const namespace = normalizeViewerNamespace(viewerHandle);
  return namespace ? `${FILTER_RULES_NAMESPACE_PREFIX}${namespace}` : FILTER_RULES_KEY;
}

export function isFilterRulesStorageKey(key: string): boolean {
  return key === FILTER_RULES_KEY || key.startsWith(FILTER_RULES_NAMESPACE_PREFIX);
}

export function isFilterRulesStorageChange(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
  viewerHandle?: string | null,
): boolean {
  if (areaName !== "local") return false;
  if (viewerHandle !== undefined) {
    return Object.prototype.hasOwnProperty.call(
      changes,
      filterRulesStorageKey(viewerHandle),
    );
  }
  return Object.keys(changes).some(isFilterRulesStorageKey);
}

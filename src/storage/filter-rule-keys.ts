export const FILTER_RULES_KEY = "notBrother.filterRules.v1";

export function isFilterRulesStorageChange(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
): boolean {
  return areaName === "local" &&
    Object.prototype.hasOwnProperty.call(changes, FILTER_RULES_KEY);
}

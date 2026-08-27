import {
  createEmptyFilterRuleSet,
  parseFilterRuleSet,
  type FilterRuleSet,
} from "../domain/filter-rules";
import {
  FILTER_RULES_KEY,
  filterRulesStorageKey,
  normalizeViewerNamespace,
} from "./filter-rule-keys";

export {
  FILTER_RULES_KEY,
  FILTER_RULES_NAMESPACE_PREFIX,
  filterRulesStorageKey,
  isFilterRulesStorageChange,
  isFilterRulesStorageKey,
  normalizeViewerNamespace,
} from "./filter-rule-keys";

function localStorageArea(): chrome.storage.StorageArea {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    throw new Error("Extension context invalidated.");
  }
  return chrome.storage.local;
}

async function migrateLegacyFilterRules(namespace: string): Promise<void> {
  const namespacedKey = filterRulesStorageKey(namespace);
  const items = await localStorageArea().get([namespacedKey, FILTER_RULES_KEY]);
  if (items[namespacedKey] !== undefined || items[FILTER_RULES_KEY] === undefined) return;
  await localStorageArea().set({ [namespacedKey]: items[FILTER_RULES_KEY] });
  await localStorageArea().remove(FILTER_RULES_KEY);
}

export async function getStoredFilterRuleSet(
  viewerHandle?: string | null,
): Promise<FilterRuleSet | null> {
  const namespace = normalizeViewerNamespace(viewerHandle);
  if (namespace) await migrateLegacyFilterRules(namespace);
  const key = filterRulesStorageKey(namespace);
  const items = await localStorageArea().get(key);
  const saved = items[key];
  if (saved === undefined) return null;
  return parseFilterRuleSet(saved);
}

export async function getFilterRuleSet(
  viewerHandle?: string | null,
): Promise<FilterRuleSet> {
  return (await getStoredFilterRuleSet(viewerHandle)) ?? createEmptyFilterRuleSet();
}

export async function saveFilterRuleSet(
  ruleSet: FilterRuleSet,
  viewerHandle?: string | null,
): Promise<FilterRuleSet> {
  const parsed = parseFilterRuleSet(ruleSet);
  const namespace = normalizeViewerNamespace(viewerHandle);
  const key = filterRulesStorageKey(namespace);
  await localStorageArea().set({ [key]: parsed });
  if (namespace) await localStorageArea().remove(FILTER_RULES_KEY);
  return parsed;
}

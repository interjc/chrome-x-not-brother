import {
  createEmptyFilterRuleSet,
  parseFilterRuleSet,
  type FilterRuleSet,
} from "../domain/filter-rules";
import { FILTER_RULES_KEY } from "./filter-rule-keys";

export { FILTER_RULES_KEY, isFilterRulesStorageChange } from "./filter-rule-keys";

function localStorageArea(): chrome.storage.StorageArea {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    throw new Error("Extension context invalidated.");
  }
  return chrome.storage.local;
}

export async function getFilterRuleSet(): Promise<FilterRuleSet> {
  const items = await localStorageArea().get(FILTER_RULES_KEY);
  const saved = items[FILTER_RULES_KEY];
  if (saved === undefined) return createEmptyFilterRuleSet();
  return parseFilterRuleSet(saved);
}

export async function saveFilterRuleSet(ruleSet: FilterRuleSet): Promise<FilterRuleSet> {
  const parsed = parseFilterRuleSet(ruleSet);
  await localStorageArea().set({ [FILTER_RULES_KEY]: parsed });
  return parsed;
}

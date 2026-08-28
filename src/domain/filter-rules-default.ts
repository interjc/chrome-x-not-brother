import defaultFilterRulesJson from "../../config/filter-rules-default.json";
import { parseFilterRuleSet, type FilterRuleSet } from "./filter-rules";

export const DEFAULT_FILTER_RULES_URL =
  "https://github.com/interjc/chrome-x-not-brother-rules/raw/refs/heads/main/rules/filter-default.json";

export const bundledDefaultFilterRuleSet: FilterRuleSet = parseFilterRuleSet(
  defaultFilterRulesJson,
);

export const bundledDefaultFilterRuleJson = `${JSON.stringify(
  bundledDefaultFilterRuleSet,
  null,
  2,
)}\n`;

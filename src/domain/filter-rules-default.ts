import defaultFilterRulesJson from "../../config/filter-rules-default.json";
import { parseFilterRuleSet, type FilterRuleSet } from "./filter-rules";

export const DEFAULT_FILTER_RULES_URL =
  "https://raw.githubusercontent.com/interjc/chrome-x-not-brother/refs/heads/main/config/filter-rules-default.json";

export const bundledDefaultFilterRuleSet: FilterRuleSet = parseFilterRuleSet(
  defaultFilterRulesJson,
);

export const bundledDefaultFilterRuleJson = `${JSON.stringify(
  bundledDefaultFilterRuleSet,
  null,
  2,
)}\n`;

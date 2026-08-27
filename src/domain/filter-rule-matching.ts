import type { FilterRule, FilterRuleSet, TextMatch } from "./filter-rules";

export const MAX_FILTER_MATCH_TEXT_LENGTH = 5_000;

export interface FilterCandidate {
  userKey: string;
  displayName: string | null;
  contentText: string | null;
}

export interface CompiledFilterRuleSet {
  activeRuleCount: number;
  match(candidate: FilterCandidate, at?: number): FilterRule | null;
}

function normalizedMatchText(value: string): string {
  return value.normalize("NFKC").slice(0, MAX_FILTER_MATCH_TEXT_LENGTH);
}

function compileTextMatch(match: TextMatch): (value: string | null) => boolean {
  if (match.mode === "contains") {
    const needle = normalizedMatchText(match.value);
    const expected = match.caseSensitive ? needle : needle.toLowerCase();
    return (value): boolean => {
      if (!value) return false;
      const candidate = normalizedMatchText(value);
      return (match.caseSensitive ? candidate : candidate.toLowerCase()).includes(expected);
    };
  }
  const expression = new RegExp(match.value, match.caseSensitive ? "u" : "iu");
  return (value): boolean => Boolean(value && expression.test(normalizedMatchText(value)));
}

export function compileFilterRuleSet(
  ruleSet: Pick<FilterRuleSet, "rules">,
  now = Date.now(),
): CompiledFilterRuleSet {
  const enabled = ruleSet.rules.filter((rule) => rule.enabled);
  const compiled = enabled.map((rule) => {
    if (rule.type === "user_handles") {
      const handles = new Set(rule.handles);
      return {
        rule,
        matches: (candidate: FilterCandidate): boolean =>
          handles.has(candidate.userKey.replace(/^@/, "").toLowerCase()),
      };
    }
    const matchesText = compileTextMatch(rule.match);
    return {
      rule,
      matches: (candidate: FilterCandidate): boolean => matchesText(
        rule.type === "display_name" ? candidate.displayName : candidate.contentText,
      ),
    };
  });
  return {
    activeRuleCount: enabled.filter((rule) =>
      rule.expiresAt === null || Date.parse(rule.expiresAt) > now,
    ).length,
    match(candidate, at = Date.now()): FilterRule | null {
      for (const item of compiled) {
        if (item.rule.expiresAt !== null && Date.parse(item.rule.expiresAt) <= at) continue;
        if (item.matches(candidate)) return item.rule;
      }
      return null;
    },
  };
}

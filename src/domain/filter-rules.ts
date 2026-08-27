import safeRegex from "safe-regex2";
import { z } from "zod";

export const FILTER_RULES_FORMAT = "not-brother-filter-rules";
export const FILTER_RULES_SCHEMA_VERSION = 1;
export const MAX_FILTER_RULES_JSON_BYTES = 1024 * 1024;
export const MAX_FILTER_RULES = 500;
export const MAX_HANDLES_PER_RULE = 10_000;
export const MAX_FILTER_PATTERN_LENGTH = 256;

const handleSchema = z.string()
  .trim()
  .transform((value) => value.replace(/^@/, "").toLowerCase())
  .pipe(z.string().regex(/^[a-z0-9_]{1,15}$/, "Use a valid X handle."));

const expiresAtSchema = z.union([
  z.null(),
  z.iso.datetime({ offset: true }).transform((value) => new Date(value).toISOString()),
]);

const textMatchSchema = z.object({
  mode: z.enum(["contains", "regex"]),
  value: z.string().trim().min(1, "Enter text to match.").max(MAX_FILTER_PATTERN_LENGTH),
  caseSensitive: z.boolean(),
}).strict().superRefine((match, context) => {
  if (match.mode !== "regex") return;
  try {
    new RegExp(match.value, match.caseSensitive ? "u" : "iu");
  } catch {
    context.addIssue({
      code: "custom",
      path: ["value"],
      message: "Enter a valid regular expression.",
    });
    return;
  }
  if (!safeRegex(match.value)) {
    context.addIssue({
      code: "custom",
      path: ["value"],
      message: "This regular expression may take too long to evaluate.",
    });
  }
});

const commonRuleShape = {
  id: z.string().trim().min(1).max(64)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, "Use letters, numbers, dot, colon, underscore, or hyphen."),
  label: z.string().trim().min(1, "Enter a rule name.").max(120),
  enabled: z.boolean(),
  expiresAt: expiresAtSchema,
};

const userHandlesRuleSchema = z.object({
  ...commonRuleShape,
  type: z.literal("user_handles"),
  handles: z.array(handleSchema).min(1, "Add at least one handle.")
    .max(MAX_HANDLES_PER_RULE),
}).strict().superRefine((rule, context) => {
  const seen = new Set<string>();
  rule.handles.forEach((handle, index) => {
    if (seen.has(handle)) {
      context.addIssue({
        code: "custom",
        path: ["handles", index],
        message: `Duplicate handle: @${handle}`,
      });
    }
    seen.add(handle);
  });
});

const displayNameRuleSchema = z.object({
  ...commonRuleShape,
  type: z.literal("display_name"),
  match: textMatchSchema,
}).strict();

const contentRuleSchema = z.object({
  ...commonRuleShape,
  type: z.literal("content"),
  match: textMatchSchema,
}).strict();

export const FilterRuleSchema = z.discriminatedUnion("type", [
  userHandlesRuleSchema,
  displayNameRuleSchema,
  contentRuleSchema,
]);

export const FilterRuleSetSchema = z.object({
  format: z.literal(FILTER_RULES_FORMAT),
  schemaVersion: z.literal(FILTER_RULES_SCHEMA_VERSION),
  name: z.string().trim().min(1, "Enter a rule-set name.").max(120),
  description: z.string().trim().max(500).default(""),
  rules: z.array(FilterRuleSchema).max(MAX_FILTER_RULES),
}).strict().superRefine((ruleSet, context) => {
  const seen = new Set<string>();
  ruleSet.rules.forEach((rule, index) => {
    if (seen.has(rule.id)) {
      context.addIssue({
        code: "custom",
        path: ["rules", index, "id"],
        message: `Duplicate rule id: ${rule.id}`,
      });
    }
    seen.add(rule.id);
  });
});

export type TextMatch = z.infer<typeof textMatchSchema>;
export type FilterRule = z.infer<typeof FilterRuleSchema>;
export type FilterRuleSet = z.infer<typeof FilterRuleSetSchema>;
export type FilterRuleType = FilterRule["type"];

export class FilterRuleValidationError extends Error {
  readonly issues: z.core.$ZodIssue[];

  constructor(message: string, issues: z.core.$ZodIssue[] = []) {
    super(message);
    this.name = "FilterRuleValidationError";
    this.issues = issues;
  }
}

export function createEmptyFilterRuleSet(): FilterRuleSet {
  return {
    format: FILTER_RULES_FORMAT,
    schemaVersion: FILTER_RULES_SCHEMA_VERSION,
    name: "My blacklist rules",
    description: "",
    rules: [],
  };
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function parseFilterRuleSet(value: unknown): FilterRuleSet {
  const result = FilterRuleSetSchema.safeParse(value);
  if (!result.success) {
    throw new FilterRuleValidationError("Invalid filter rule set.", result.error.issues);
  }
  return result.data;
}

export function parseFilterRuleSetJson(text: string): FilterRuleSet {
  if (byteLength(text) > MAX_FILTER_RULES_JSON_BYTES) {
    throw new FilterRuleValidationError("Filter rule JSON exceeds the 1 MiB limit.");
  }
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new FilterRuleValidationError("Filter rules must be valid JSON.");
  }
  return parseFilterRuleSet(value);
}

export function serializeFilterRuleSet(ruleSet: FilterRuleSet): string {
  const json = JSON.stringify(parseFilterRuleSet(ruleSet), null, 2);
  if (byteLength(json) > MAX_FILTER_RULES_JSON_BYTES) {
    throw new FilterRuleValidationError("Filter rule JSON exceeds the 1 MiB limit.");
  }
  return json;
}

export function mergeFilterRuleSets(
  current: FilterRuleSet,
  incoming: FilterRuleSet,
  replace = false,
): FilterRuleSet {
  const parsedCurrent = parseFilterRuleSet(current);
  const parsedIncoming = parseFilterRuleSet(incoming);
  if (replace) return parsedIncoming;

  const incomingById = new Map(parsedIncoming.rules.map((rule) => [rule.id, rule]));
  const currentIds = new Set(parsedCurrent.rules.map((rule) => rule.id));
  const rules = parsedCurrent.rules.map((rule) => incomingById.get(rule.id) ?? rule);
  for (const rule of parsedIncoming.rules) {
    if (!currentIds.has(rule.id)) rules.push(rule);
  }
  return parseFilterRuleSet({
    ...parsedCurrent,
    name: parsedCurrent.rules.length === 0 ? parsedIncoming.name : parsedCurrent.name,
    description: parsedCurrent.rules.length === 0
      ? parsedIncoming.description
      : parsedCurrent.description,
    rules,
  });
}

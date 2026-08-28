export interface HideStats {
  hiddenByRules: number;
  hiddenByMuted: number;
  hiddenByBlockedBy: number;
}

export type HideStatsDelta = Partial<HideStats>;

export function emptyHideStats(): HideStats {
  return {
    hiddenByRules: 0,
    hiddenByMuted: 0,
    hiddenByBlockedBy: 0,
  };
}

function nonNegativeInt(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
  return Math.min(Math.floor(value), Number.MAX_SAFE_INTEGER);
}

export function coerceHideStats(value: unknown): HideStats {
  const record = value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    hiddenByRules: nonNegativeInt(record.hiddenByRules),
    hiddenByMuted: nonNegativeInt(record.hiddenByMuted),
    hiddenByBlockedBy: nonNegativeInt(record.hiddenByBlockedBy),
  };
}

export function addHideStats(current: HideStats, delta: HideStatsDelta): HideStats {
  return {
    hiddenByRules: current.hiddenByRules + nonNegativeInt(delta.hiddenByRules),
    hiddenByMuted: current.hiddenByMuted + nonNegativeInt(delta.hiddenByMuted),
    hiddenByBlockedBy: current.hiddenByBlockedBy + nonNegativeInt(delta.hiddenByBlockedBy),
  };
}

export function hideStatsHaveIncrements(delta: HideStatsDelta): boolean {
  return nonNegativeInt(delta.hiddenByRules) > 0 ||
    nonNegativeInt(delta.hiddenByMuted) > 0 ||
    nonNegativeInt(delta.hiddenByBlockedBy) > 0;
}

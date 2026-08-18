import type { RelationshipKind, UserRecord } from "../domain/types";

export const SIDE_PANEL_SUMMARY_KINDS = [
  "mutual",
  "following_only",
  "follows_you_only",
  "blocked_by",
] as const satisfies readonly RelationshipKind[];

export type SidePanelFilter =
  | "all"
  | "changed"
  | (typeof SIDE_PANEL_SUMMARY_KINDS)[number];

export function filterSidePanelUsers(
  users: UserRecord[],
  filter: SidePanelFilter,
): UserRecord[] {
  if (filter === "all") return users;
  if (filter === "changed") return users.filter((user) => user.hasChanged);
  return users.filter((user) => user.currentRelationship === filter);
}

export function toggleSidePanelFilter(
  current: SidePanelFilter,
  next: Exclude<SidePanelFilter, "all">,
): SidePanelFilter {
  return current === next ? "all" : next;
}

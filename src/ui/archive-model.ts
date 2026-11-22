import { recordedRelationshipChange } from "../domain/relationships";
import type {
  RelationshipChangeKind,
  UserRecord,
  VisibleRelationship,
} from "../domain/types";

export const ARCHIVE_RELATIONSHIP_FILTERS = [
  "all",
  "mutual",
  "following_only",
  "follows_you_only",
  "blocked_by",
] as const satisfies readonly ("all" | VisibleRelationship)[];

export const ARCHIVE_CHANGE_FILTERS = [
  "all",
  "any",
  "pending",
  "unfollowed_you",
  "you_unfollowed",
  "blocked_you",
  "changed",
] as const satisfies readonly ("all" | "any" | "pending" | RelationshipChangeKind)[];

export const ARCHIVE_SORTS = ["recent", "changed", "handle", "observations"] as const;

export type ArchiveRelationshipFilter = (typeof ARCHIVE_RELATIONSHIP_FILTERS)[number];
export type ArchiveChangeFilter = (typeof ARCHIVE_CHANGE_FILTERS)[number];
export type ArchiveSort = (typeof ARCHIVE_SORTS)[number];

export interface ArchiveQuery {
  relationship: ArchiveRelationshipFilter;
  change: ArchiveChangeFilter;
  text: string;
  sort: ArchiveSort;
}

export const DEFAULT_ARCHIVE_QUERY: ArchiveQuery = {
  relationship: "all",
  change: "all",
  text: "",
  sort: "recent",
};

export function matchesRelationship(
  user: UserRecord,
  filter: ArchiveRelationshipFilter,
): boolean {
  return filter === "all" || user.currentRelationship === filter;
}

export function matchesChange(user: UserRecord, filter: ArchiveChangeFilter): boolean {
  if (filter === "all") return true;
  const change = recordedRelationshipChange(user);
  if (!change) return false;
  if (filter === "any") return true;
  if (filter === "pending") return change.pending;
  return change.kind === filter;
}

export function matchesText(user: UserRecord, text: string): boolean {
  const query = text.trim().replace(/^@/, "").toLowerCase();
  if (!query) return true;
  return user.handle.toLowerCase().includes(query) ||
    Boolean(user.displayName?.toLowerCase().includes(query));
}

function changeTime(user: UserRecord): number {
  const change = recordedRelationshipChange(user);
  return change ? change.detectedAt ?? 0 : -1;
}

function compareUsers(sort: ArchiveSort): (a: UserRecord, b: UserRecord) => number {
  if (sort === "handle") return (a, b) => a.handle.localeCompare(b.handle);
  if (sort === "observations") {
    return (a, b) => b.observationCount - a.observationCount || b.lastSeenAt - a.lastSeenAt;
  }
  if (sort === "changed") {
    return (a, b) => changeTime(b) - changeTime(a) || b.lastSeenAt - a.lastSeenAt;
  }
  return (a, b) => b.lastSeenAt - a.lastSeenAt;
}

export function filterArchiveUsers(users: UserRecord[], query: ArchiveQuery): UserRecord[] {
  return users
    .filter((user) =>
      matchesRelationship(user, query.relationship) &&
      matchesChange(user, query.change) &&
      matchesText(user, query.text))
    .toSorted(compareUsers(query.sort));
}

export interface ArchiveFacetCounts {
  relationship: Record<ArchiveRelationshipFilter, number>;
  change: Record<ArchiveChangeFilter, number>;
}

/**
 * Counts for each filter option given the other active filters, so a number
 * always says how many rows picking that option would show.
 */
export function archiveFacetCounts(users: UserRecord[], query: ArchiveQuery): ArchiveFacetCounts {
  const searched = users.filter((user) => matchesText(user, query.text));
  const forRelationship = searched.filter((user) => matchesChange(user, query.change));
  const forChange = searched.filter((user) => matchesRelationship(user, query.relationship));
  const relationship = Object.fromEntries(ARCHIVE_RELATIONSHIP_FILTERS.map((filter) => [
    filter,
    forRelationship.filter((user) => matchesRelationship(user, filter)).length,
  ])) as Record<ArchiveRelationshipFilter, number>;
  const change = Object.fromEntries(ARCHIVE_CHANGE_FILTERS.map((filter) => [
    filter,
    forChange.filter((user) => matchesChange(user, filter)).length,
  ])) as Record<ArchiveChangeFilter, number>;
  return { relationship, change };
}

export function hasActiveArchiveFilters(query: ArchiveQuery): boolean {
  return query.relationship !== "all" || query.change !== "all" || query.text.trim() !== "";
}

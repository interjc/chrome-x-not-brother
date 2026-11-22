import { describe, expect, it } from "vitest";
import type { UserRecord } from "../domain/types";
import {
  DEFAULT_ARCHIVE_QUERY,
  archiveFacetCounts,
  filterArchiveUsers,
  hasActiveArchiveFilters,
} from "./archive-model";

function user(handle: string, patch: Partial<UserRecord> = {}): UserRecord {
  return {
    key: handle,
    handle,
    displayName: handle.toUpperCase(),
    avatarUrl: null,
    profileUrl: `https://x.com/${handle}`,
    currentRelationship: "mutual",
    previousRelationship: null,
    hasChanged: false,
    changeDetectedAt: null,
    firstSeenAt: 1,
    lastSeenAt: 1,
    observationCount: 1,
    lastSourceUrl: "https://x.com/home",
    lastSourceType: "timeline",
    latestEvidence: [],
    ...patch,
  };
}

const users = [
  user("ann", { lastSeenAt: 5 }),
  user("ben", {
    currentRelationship: "following_only",
    previousRelationship: "mutual",
    hasChanged: true,
    changeDetectedAt: 20,
    lastSeenAt: 3,
  }),
  user("cat", {
    currentRelationship: "follows_you_only",
    previousRelationship: "mutual",
    changeDetectedAt: 30,
    lastSeenAt: 4,
    observationCount: 9,
  }),
  user("dan", { currentRelationship: "following_only", lastSeenAt: 2 }),
];

describe("archive model", () => {
  it("combines relationship, change, and text filters", () => {
    const keys = (query: Partial<typeof DEFAULT_ARCHIVE_QUERY>) =>
      filterArchiveUsers(users, { ...DEFAULT_ARCHIVE_QUERY, ...query }).map((item) => item.key);
    expect(keys({})).toEqual(["ann", "cat", "ben", "dan"]);
    expect(keys({ relationship: "following_only" })).toEqual(["ben", "dan"]);
    expect(keys({ change: "any" })).toEqual(["cat", "ben"]);
    expect(keys({ change: "pending" })).toEqual(["ben"]);
    expect(keys({ change: "you_unfollowed" })).toEqual(["cat"]);
    expect(keys({ relationship: "following_only", change: "any" })).toEqual(["ben"]);
    expect(keys({ text: "@BE" })).toEqual(["ben"]);
    expect(keys({ text: "CAT" })).toEqual(["cat"]);
  });

  it("sorts by latest change with unchanged rows last", () => {
    const sorted = filterArchiveUsers(users, { ...DEFAULT_ARCHIVE_QUERY, sort: "changed" });
    expect(sorted.map((item) => item.key)).toEqual(["cat", "ben", "ann", "dan"]);
  });

  it("counts each facet against the other active filters", () => {
    const counts = archiveFacetCounts(users, { ...DEFAULT_ARCHIVE_QUERY, change: "any" });
    expect(counts.relationship).toEqual({
      all: 2,
      mutual: 0,
      following_only: 1,
      follows_you_only: 1,
      blocked_by: 0,
    });
    expect(counts.change.all).toBe(4);
    expect(counts.change.unfollowed_you).toBe(1);

    const oneWay = archiveFacetCounts(users, { ...DEFAULT_ARCHIVE_QUERY, relationship: "following_only" });
    expect(oneWay.change.all).toBe(2);
    expect(oneWay.change.any).toBe(1);
    expect(oneWay.change.you_unfollowed).toBe(0);
  });

  it("reports active filters without counting sort", () => {
    expect(hasActiveArchiveFilters(DEFAULT_ARCHIVE_QUERY)).toBe(false);
    expect(hasActiveArchiveFilters({ ...DEFAULT_ARCHIVE_QUERY, sort: "handle" })).toBe(false);
    expect(hasActiveArchiveFilters({ ...DEFAULT_ARCHIVE_QUERY, text: " a " })).toBe(true);
  });
});

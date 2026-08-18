import { describe, expect, it } from "vitest";
import {
  candidateDisplayRelationship,
  displayRelationship,
  isCollectableRelationship,
  mergeUserObservation,
  relationshipChangeKind,
  resolveRelationship,
} from "./relationships";
import type { ObservationDraft, UserRecord } from "./types";

function observation(
  relationship: ObservationDraft["relationship"],
  observedAt = 1_000,
): ObservationDraft {
  return {
    userKey: "alice",
    handle: "Alice",
    displayName: "Alice Example",
    avatarUrl: null,
    profileUrl: "https://x.com/Alice",
    observedAt,
    sourceUrl: "https://x.com/viewer/following",
    sourceType: "following",
    relationship,
    evidence: relationship === "unknown" ? ["insufficient-evidence"] : ["following-control"],
  };
}

function existing(relationship: UserRecord["currentRelationship"]): UserRecord {
  return mergeUserObservation(undefined, observation(relationship)).user;
}

describe("resolveRelationship", () => {
  it("keeps unknown internal and out of collection", () => {
    expect(isCollectableRelationship("unknown")).toBe(false);
    expect(isCollectableRelationship("following_only")).toBe(true);
    expect(isCollectableRelationship("blocked_by")).toBe(true);
  });

  it("reuses a known local relationship when the current card has no fresh evidence", () => {
    expect(candidateDisplayRelationship("unknown", existing("blocked_by"))).toBe("blocked_by");
    expect(candidateDisplayRelationship("unknown", undefined)).toBeNull();
    expect(candidateDisplayRelationship("unknown", existing("unknown"))).toBeNull();
  });

  it("prioritizes an explicit blocked notice", () => {
    expect(resolveRelationship({ following: true, followsYou: true, blockedBy: true })).toBe("blocked_by");
  });

  it.each([
    [true, true, "mutual"],
    [true, false, "following_only"],
    [false, true, "follows_you_only"],
    [null, true, "unknown"],
    [false, false, "unknown"],
  ] as const)("maps following=%s followsYou=%s to %s", (following, followsYou, expected) => {
    expect(resolveRelationship({ following, followsYou, blockedBy: false })).toBe(expected);
  });
});

describe("mergeUserObservation", () => {
  it("creates the first user without a false change", () => {
    const result = mergeUserObservation(undefined, observation("following_only"));
    expect(result.user.currentRelationship).toBe("following_only");
    expect(result.user.hasChanged).toBe(false);
    expect(result.user.observationCount).toBe(1);
    expect(result.appendHistory).toBe(true);
  });

  it("marks a change between two known states", () => {
    const result = mergeUserObservation(existing("mutual"), observation("following_only", 2_000));
    expect(result.user.currentRelationship).toBe("following_only");
    expect(result.user.previousRelationship).toBe("mutual");
    expect(result.user.hasChanged).toBe(true);
    expect(result.user.changeDetectedAt).toBe(2_000);
    expect(result.appendHistory).toBe(true);
  });

  it("does not let unknown erase a known relationship", () => {
    const result = mergeUserObservation(existing("mutual"), observation("unknown", 2_000));
    expect(result.user.currentRelationship).toBe("mutual");
    expect(result.user.latestEvidence).toEqual(["following-control"]);
    expect(result.user.hasChanged).toBe(false);
  });

  it("records a heartbeat only after the history interval", () => {
    const first = existing("mutual");
    const tooSoon = mergeUserObservation(first, observation("mutual", first.lastSeenAt + 60_000));
    expect(tooSoon.appendHistory).toBe(false);
    const later = mergeUserObservation(first, observation("mutual", first.lastSeenAt + 15 * 60_000));
    expect(later.appendHistory).toBe(true);
  });

  it("records a late observation without overwriting newer current state", () => {
    const current = mergeUserObservation(
      existing("mutual"),
      observation("following_only", 3_000),
    ).user;
    const late = mergeUserObservation(current, observation("blocked_by", 2_000));

    expect(late.user.currentRelationship).toBe("following_only");
    expect(late.user.lastSeenAt).toBe(3_000);
    expect(late.user.observationCount).toBe(current.observationCount + 1);
    expect(late.appendHistory).toBe(true);
  });
});

describe("relationship change presentation", () => {
  it.each([
    ["following_only", "mutual", "followed_back"],
    ["mutual", "following_only", "unfollowed_you"],
    ["mutual", "blocked_by", "blocked_you"],
    ["following_only", "blocked_by", "blocked_you"],
  ] as const)("describes %s → %s as %s", (previous, current, expected) => {
    const changed = mergeUserObservation(
      existing(previous),
      observation(current, 2_000),
    ).user;
    expect(relationshipChangeKind(changed)).toBe(expected);
    expect(displayRelationship(changed)).toBe(expected);
  });

  it("keeps ambiguous or viewer-driven transitions generic", () => {
    const changed = mergeUserObservation(
      existing("mutual"),
      observation("follows_you_only", 2_000),
    ).user;
    expect(relationshipChangeKind(changed)).toBeNull();
    expect(displayRelationship(changed)).toBe("changed");
  });
});

import { describe, expect, it } from "vitest";
import {
  candidateDisplayRelationship,
  displayRelationship,
  isCollectableRelationship,
  isDisplayedUser,
  isVisibleRelationship,
  mergeUserObservation,
  relationshipChangeKind,
  resolveRelationship,
  shouldPersistObservation,
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
    evidence: relationship === "unknown"
      ? ["insufficient-evidence"]
      : relationship === "none"
        ? ["follow-control"]
        : ["following-control"],
  };
}

function existing(relationship: UserRecord["currentRelationship"]): UserRecord {
  return mergeUserObservation(undefined, observation(relationship)).user;
}

describe("resolveRelationship", () => {
  it("keeps unknown internal and out of collection", () => {
    expect(isCollectableRelationship("unknown")).toBe(false);
    expect(isCollectableRelationship("none")).toBe(true);
    expect(isCollectableRelationship("following_only")).toBe(true);
    expect(isCollectableRelationship("blocked_by")).toBe(true);
    expect(isVisibleRelationship("none")).toBe(false);
    expect(isVisibleRelationship("mutual")).toBe(true);
  });

  it("reuses a known local relationship when the current card has no fresh evidence", () => {
    expect(candidateDisplayRelationship("unknown", existing("blocked_by"))).toBe("blocked_by");
    expect(candidateDisplayRelationship("unknown", undefined)).toBeNull();
    expect(candidateDisplayRelationship("unknown", existing("unknown"))).toBeNull();
    expect(candidateDisplayRelationship("unknown", existing("none"))).toBeNull();
  });

  it("shows a fresh visible state instead of a stored none record", () => {
    expect(candidateDisplayRelationship("following_only", existing("none"))).toBe("following_only");
  });

  it("shows mutual immediately when the current card is mutual", () => {
    const stored = mergeUserObservation(
      existing("following_only"),
      observation("mutual", 2_000),
    ).user;
    expect(candidateDisplayRelationship("mutual", stored)).toBe("mutual");
    expect(displayRelationship(stored)).toBe("mutual");
  });

  it("prioritizes an explicit blocked notice", () => {
    expect(resolveRelationship({ following: true, followsYou: true, blockedBy: true })).toBe("blocked_by");
  });

  it.each([
    [true, true, "mutual"],
    [true, false, "following_only"],
    [false, true, "follows_you_only"],
    [null, true, "unknown"],
    [false, false, "none"],
    [null, false, "unknown"],
  ] as const)("maps following=%s followsYou=%s to %s", (following, followsYou, expected) => {
    expect(resolveRelationship({ following, followsYou, blockedBy: false })).toBe(expected);
  });
});

describe("mergeUserObservation", () => {
  it("keeps a usable display name when a later observation only has a separator", () => {
    const first = mergeUserObservation(undefined, {
      ...observation("mutual"),
      displayName: "Alice Example",
      avatarUrl: "https://pbs.twimg.com/profile_images/1/alice_normal.jpg",
    });
    const later = mergeUserObservation(first.user, {
      ...observation("mutual", 2_000),
      displayName: "·",
      avatarUrl: null,
    });
    expect(later.user.displayName).toBe("Alice Example");
    expect(later.user.avatarUrl).toBe("https://pbs.twimg.com/profile_images/1/alice_x96.jpg");
  });

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

  it("lets explicit neither-following replace a known relationship without a reviewable change", () => {
    const result = mergeUserObservation(existing("mutual"), observation("none", 2_000));
    expect(result.user.currentRelationship).toBe("none");
    expect(result.user.previousRelationship).toBe("mutual");
    expect(result.user.hasChanged).toBe(false);
    expect(displayRelationship(result.user)).toBe("unknown");
    expect(isDisplayedUser(result.user)).toBe(false);
    expect(candidateDisplayRelationship("none", result.user)).toBeNull();
  });

  it("shows 对方取关 when an account that only followed you unfollows", () => {
    const changed = mergeUserObservation(
      existing("follows_you_only"),
      observation("none", 2_000),
    ).user;
    expect(changed.currentRelationship).toBe("none");
    expect(changed.hasChanged).toBe(true);
    expect(relationshipChangeKind(changed)).toBe("unfollowed_you");
    expect(displayRelationship(changed)).toBe("unfollowed_you");
    expect(isDisplayedUser(changed)).toBe(true);
    expect(candidateDisplayRelationship("none", existing("follows_you_only"))).toBe("unfollowed_you");
    expect(candidateDisplayRelationship("unknown", changed)).toBe("unfollowed_you");
  });

  it("persists none only when it replaces a visible relationship", () => {
    expect(shouldPersistObservation(observation("none"), undefined)).toBe(false);
    expect(shouldPersistObservation(observation("none"), existing("none"))).toBe(false);
    expect(shouldPersistObservation(observation("none"), existing("mutual"))).toBe(true);
    expect(shouldPersistObservation(observation("none"), existing("follows_you_only"))).toBe(true);
    expect(shouldPersistObservation(observation("mutual"), undefined)).toBe(true);
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
    ["mutual", "following_only", "unfollowed_you", "unfollowed_you"],
    ["follows_you_only", "following_only", "unfollowed_you", "unfollowed_you"],
    ["follows_you_only", "none", "unfollowed_you", "unfollowed_you"],
    ["mutual", "follows_you_only", "you_unfollowed", "you_unfollowed"],
    ["mutual", "blocked_by", "blocked_you", "blocked_you"],
    ["following_only", "blocked_by", "blocked_you", "blocked_you"],
    ["following_only", "mutual", null, "mutual"],
    ["follows_you_only", "mutual", null, "mutual"],
  ] as const)("describes %s → %s as %s / %s", (previous, current, event, display) => {
    const changed = mergeUserObservation(
      existing(previous),
      observation(current, 2_000),
    ).user;
    expect(relationshipChangeKind(changed)).toBe(event);
    expect(displayRelationship(changed)).toBe(display);
  });

  it("keeps double-action transitions generic", () => {
    const changed = mergeUserObservation(
      existing("following_only"),
      observation("follows_you_only", 2_000),
    ).user;
    expect(relationshipChangeKind(changed)).toBeNull();
    expect(displayRelationship(changed)).toBe("changed");
  });

  it("shows one-way following unless history says they used to follow you", () => {
    expect(displayRelationship(existing("following_only"))).toBe("following_only");
    expect(candidateDisplayRelationship("following_only", undefined)).toBe("following_only");
    const fromBlocked = mergeUserObservation(
      existing("blocked_by"),
      observation("following_only", 2_000),
    ).user;
    expect(fromBlocked.hasChanged).toBe(true);
    expect(relationshipChangeKind(fromBlocked)).toBeNull();
    expect(displayRelationship(fromBlocked)).toBe("following_only");
    expect(candidateDisplayRelationship("following_only", existing("follows_you_only")))
      .toBe("unfollowed_you");
    expect(candidateDisplayRelationship("following_only", existing("mutual")))
      .toBe("unfollowed_you");
  });
});

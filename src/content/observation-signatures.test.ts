import { describe, expect, it } from "vitest";
import type { ObservationDraft, UserRecord } from "../domain/types";
import { createObservationSignatureTracker } from "./observation-signatures";

function observation(
  userKey: string,
  relationship: ObservationDraft["relationship"] = "following_only",
): ObservationDraft {
  return {
    userKey,
    handle: userKey,
    displayName: null,
    avatarUrl: null,
    profileUrl: `https://x.com/${userKey}`,
    observedAt: 1,
    sourceUrl: "https://x.com/home",
    sourceType: "timeline",
    relationship,
    evidence: ["following-control"],
  };
}

function user(draft: ObservationDraft): UserRecord {
  return {
    key: draft.userKey,
    handle: draft.handle,
    displayName: null,
    avatarUrl: null,
    profileUrl: draft.profileUrl,
    currentRelationship: draft.relationship,
    previousRelationship: null,
    hasChanged: false,
    changeDetectedAt: null,
    firstSeenAt: 1,
    lastSeenAt: 1,
    observationCount: 1,
    lastSourceUrl: draft.sourceUrl,
    lastSourceType: draft.sourceType,
    latestEvidence: draft.evidence,
  };
}

describe("observation signature tracker", () => {
  it("deduplicates only observations confirmed as persisted", () => {
    const tracker = createObservationSignatureTracker();
    const persisted = observation("persisted");
    const rejected = observation("rejected");

    expect(tracker.filterUnsent([persisted, rejected])).toEqual([persisted, rejected]);
    tracker.markPersisted([persisted, rejected], [user(persisted)]);

    expect(tracker.filterUnsent([persisted, rejected])).toEqual([rejected]);
  });

  it("retries after an unconfirmed send and admits changed evidence", () => {
    const tracker = createObservationSignatureTracker();
    const first = observation("alice");

    expect(tracker.filterUnsent([first])).toEqual([first]);
    expect(tracker.filterUnsent([first])).toEqual([first]);
    tracker.markPersisted([first], [user(first)]);

    const changed = {
      ...first,
      relationship: "blocked_by" as const,
      evidence: ["blocked-notice" as const],
    };
    expect(tracker.filterUnsent([changed])).toEqual([changed]);
  });
});

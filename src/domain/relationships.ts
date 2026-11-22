import { preferAvatarUrl, preferDisplayName } from "./identity";
import type {
  ObservationDraft,
  RelationshipFacts,
  RelationshipChangeKind,
  RelationshipKind,
  UserRecord,
  VisibleRelationship,
} from "./types";

export function resolveRelationship(facts: RelationshipFacts): RelationshipKind {
  if (facts.blockedBy) return "blocked_by";
  if (facts.following === true && facts.followsYou === true) return "mutual";
  if (facts.following === true && facts.followsYou === false) return "following_only";
  if (facts.following === false && facts.followsYou === true) return "follows_you_only";
  if (facts.following === false && facts.followsYou === false) return "none";
  return "unknown";
}

export interface RecordedRelationshipChange {
  kind: RelationshipChangeKind;
  previous: RelationshipKind;
  current: VisibleRelationship;
  detectedAt: number | null;
  /** Not yet marked as reviewed in the archive. */
  pending: boolean;
}

/**
 * The last recorded known-to-known change for an archive row. Change is
 * archive data only: page badges always show the current state.
 */
export function recordedRelationshipChange(
  user: UserRecord,
): RecordedRelationshipChange | null {
  const previous = user.previousRelationship;
  const current = user.currentRelationship;
  if (!previous || previous === "unknown" || previous === current) return null;
  if (!isVisibleRelationship(current)) return null;
  if (!user.hasChanged && user.changeDetectedAt === null) return null;
  return {
    kind: changeKindFor(previous, current),
    previous,
    current,
    detectedAt: user.changeDetectedAt,
    pending: user.hasChanged,
  };
}

function changeKindFor(
  previous: RelationshipKind,
  current: VisibleRelationship,
): RelationshipChangeKind {
  if (current === "blocked_by") return "blocked_you";
  if (previous === "mutual" && current === "following_only") return "unfollowed_you";
  if (previous === "follows_you_only" && current === "following_only") return "unfollowed_you";
  if (previous === "mutual" && current === "follows_you_only") return "you_unfollowed";
  return "changed";
}

export function relationshipChangeKind(
  user: UserRecord,
): RelationshipChangeKind | null {
  return recordedRelationshipChange(user)?.kind ?? null;
}

/** The label a user carries anywhere: the current known state, never a change. */
export function displayRelationship(user: UserRecord): VisibleRelationship | "unknown" {
  return isVisibleRelationship(user.currentRelationship)
    ? user.currentRelationship
    : "unknown";
}

export function isCollectableRelationship(
  relationship: RelationshipKind,
): relationship is Exclude<RelationshipKind, "unknown"> {
  return relationship !== "unknown";
}

export function isVisibleRelationship(
  relationship: RelationshipKind,
): relationship is Exclude<RelationshipKind, "unknown" | "none"> {
  return relationship !== "unknown" && relationship !== "none";
}

export function isDisplayedUser(user: UserRecord): boolean {
  return displayRelationship(user) !== "unknown";
}

export function shouldPersistObservation(
  observation: ObservationDraft,
  existing?: UserRecord,
): boolean {
  if (!isCollectableRelationship(observation.relationship)) return false;
  if (observation.relationship === "none") {
    return Boolean(existing && isVisibleRelationship(existing.currentRelationship));
  }
  return true;
}

export function candidateDisplayRelationship(
  relationship: RelationshipKind,
  stored?: UserRecord,
): VisibleRelationship | null {
  if (isVisibleRelationship(relationship)) return relationship;
  if (relationship === "none" || !stored) return null;
  return isVisibleRelationship(stored.currentRelationship)
    ? stored.currentRelationship
    : null;
}

export interface MergeResult {
  user: UserRecord;
  appendHistory: boolean;
}

const HISTORY_HEARTBEAT_MS = 15 * 60 * 1000;

export function mergeUserObservation(
  existing: UserRecord | undefined,
  observation: ObservationDraft,
): MergeResult {
  if (!existing) {
    return {
      user: {
        key: observation.userKey,
        handle: observation.handle,
        displayName: preferDisplayName(observation.displayName, null, observation.handle),
        avatarUrl: preferAvatarUrl(observation.avatarUrl, null),
        profileUrl: observation.profileUrl,
        currentRelationship: observation.relationship,
        previousRelationship: null,
        hasChanged: false,
        changeDetectedAt: null,
        firstSeenAt: observation.observedAt,
        lastSeenAt: observation.observedAt,
        observationCount: 1,
        lastSourceUrl: observation.sourceUrl,
        lastSourceType: observation.sourceType,
        latestEvidence: observation.evidence,
      },
      appendHistory: true,
    };
  }

  if (observation.observedAt < existing.lastSeenAt) {
    return {
      user: {
        ...existing,
        firstSeenAt: Math.min(existing.firstSeenAt, observation.observedAt),
        observationCount: existing.observationCount + 1,
      },
      appendHistory: true,
    };
  }

  const incomingKnown = observation.relationship !== "unknown";
  const currentKnown = existing.currentRelationship !== "unknown";
  const stateChanged =
    incomingKnown &&
    currentKnown &&
    observation.relationship !== existing.currentRelationship;
  const replaceCurrent = incomingKnown || !currentKnown;
  const nextRelationship = replaceCurrent
    ? observation.relationship
    : existing.currentRelationship;
  const reviewableChange = stateChanged && nextRelationship !== "none";
  const appendHistory =
    stateChanged ||
    observation.sourceUrl !== existing.lastSourceUrl ||
    observation.observedAt - existing.lastSeenAt >= HISTORY_HEARTBEAT_MS;

  return {
    user: {
      ...existing,
      handle: observation.handle,
      displayName: preferDisplayName(
        observation.displayName,
        existing.displayName,
        observation.handle,
      ),
      avatarUrl: preferAvatarUrl(observation.avatarUrl, existing.avatarUrl),
      profileUrl: observation.profileUrl,
      currentRelationship: nextRelationship,
      previousRelationship: stateChanged
        ? existing.currentRelationship
        : existing.previousRelationship,
      hasChanged: nextRelationship === "none" && !reviewableChange
        ? false
        : existing.hasChanged || reviewableChange,
      changeDetectedAt: nextRelationship === "none" && !reviewableChange
        ? null
        : reviewableChange
          ? observation.observedAt
          : existing.changeDetectedAt,
      lastSeenAt: Math.max(existing.lastSeenAt, observation.observedAt),
      observationCount: existing.observationCount + 1,
      lastSourceUrl: observation.sourceUrl,
      lastSourceType: observation.sourceType,
      latestEvidence: replaceCurrent ? observation.evidence : existing.latestEvidence,
    },
    appendHistory,
  };
}

export function relationshipRank(relationship: RelationshipKind): number {
  switch (relationship) {
    case "blocked_by":
      return 5;
    case "mutual":
      return 4;
    case "following_only":
    case "follows_you_only":
      return 3;
    case "none":
      return 2;
    case "unknown":
      return 1;
  }
}

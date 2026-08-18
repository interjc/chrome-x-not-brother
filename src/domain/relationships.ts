import type {
  DisplayRelationship,
  ObservationDraft,
  RelationshipFacts,
  RelationshipKind,
  UserRecord,
} from "./types";

export function resolveRelationship(facts: RelationshipFacts): RelationshipKind {
  if (facts.blockedBy) return "blocked_by";
  if (facts.following === true && facts.followsYou === true) return "mutual";
  if (facts.following === true && facts.followsYou === false) return "following_only";
  if (facts.following === false && facts.followsYou === true) return "follows_you_only";
  return "unknown";
}

export function displayRelationship(user: UserRecord): DisplayRelationship {
  return user.hasChanged ? "changed" : user.currentRelationship;
}

export function isCollectableRelationship(
  relationship: RelationshipKind,
): relationship is Exclude<RelationshipKind, "unknown"> {
  return relationship !== "unknown";
}

export function candidateDisplayRelationship(
  relationship: RelationshipKind,
  stored?: UserRecord,
): DisplayRelationship | null {
  if (stored && isCollectableRelationship(stored.currentRelationship)) {
    return displayRelationship(stored);
  }
  return isCollectableRelationship(relationship) ? relationship : null;
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
        displayName: observation.displayName,
        avatarUrl: observation.avatarUrl,
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
  const appendHistory =
    stateChanged ||
    observation.sourceUrl !== existing.lastSourceUrl ||
    observation.observedAt - existing.lastSeenAt >= HISTORY_HEARTBEAT_MS;

  return {
    user: {
      ...existing,
      handle: observation.handle,
      displayName: observation.displayName ?? existing.displayName,
      avatarUrl: observation.avatarUrl ?? existing.avatarUrl,
      profileUrl: observation.profileUrl,
      currentRelationship: nextRelationship,
      previousRelationship: stateChanged
        ? existing.currentRelationship
        : existing.previousRelationship,
      hasChanged: existing.hasChanged || stateChanged,
      changeDetectedAt: stateChanged
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
    case "unknown":
      return 1;
  }
}

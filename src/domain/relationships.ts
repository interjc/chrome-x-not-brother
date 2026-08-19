import { preferAvatarUrl, preferDisplayName } from "./identity";
import type {
  DisplayRelationship,
  ObservationDraft,
  RelationshipFacts,
  RelationshipChangeKind,
  RelationshipKind,
  UserRecord,
} from "./types";

export function resolveRelationship(facts: RelationshipFacts): RelationshipKind {
  if (facts.blockedBy) return "blocked_by";
  if (facts.following === true && facts.followsYou === true) return "mutual";
  if (facts.following === true && facts.followsYou === false) return "following_only";
  if (facts.following === false && facts.followsYou === true) return "follows_you_only";
  if (facts.following === false && facts.followsYou === false) return "none";
  return "unknown";
}

export function relationshipChangeKind(
  user: UserRecord,
): RelationshipChangeKind | null {
  if (!user.hasChanged || !user.previousRelationship) return null;
  const previous = user.previousRelationship;
  const current = user.currentRelationship;
  if (current === "blocked_by" && previous !== "blocked_by") return "blocked_you";
  if (previous === "mutual" && current === "following_only") return "unfollowed_you";
  if (previous === "follows_you_only" && current === "following_only") return "unfollowed_you";
  if (previous === "follows_you_only" && current === "none") return "unfollowed_you";
  if (previous === "mutual" && current === "follows_you_only") return "you_unfollowed";
  return null;
}

export function displayRelationship(user: UserRecord): DisplayRelationship {
  if (user.currentRelationship === "mutual") return "mutual";
  if (user.hasChanged) {
    const event = relationshipChangeKind(user);
    if (event) return event;
    if (user.currentRelationship === "following_only") return "following_only";
    if (isVisibleRelationship(user.currentRelationship)) return "changed";
  }
  if (!isVisibleRelationship(user.currentRelationship)) return "unknown";
  return user.currentRelationship;
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
): DisplayRelationship | null {
  if (isVisibleRelationship(relationship)) {
    if (stored && stored.currentRelationship === relationship) {
      const display = displayRelationship(stored);
      return display === "unknown" ? null : display;
    }
    if (
      relationship === "following_only" &&
      (stored?.currentRelationship === "mutual" ||
        stored?.currentRelationship === "follows_you_only")
    ) {
      return "unfollowed_you";
    }
    return relationship;
  }
  if (relationship === "none" && stored?.currentRelationship === "follows_you_only") {
    return "unfollowed_you";
  }
  if (stored) {
    const display = displayRelationship(stored);
    return display === "unknown" ? null : display;
  }
  return null;
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
  const reviewableChange = stateChanged && (
    nextRelationship !== "none" ||
    existing.currentRelationship === "follows_you_only"
  );
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

export const RELATIONSHIP_KINDS = [
  "mutual",
  "following_only",
  "follows_you_only",
  "blocked_by",
  "none",
  "unknown",
] as const;

export type RelationshipKind = (typeof RELATIONSHIP_KINDS)[number];
export type VisibleRelationship = Exclude<RelationshipKind, "unknown" | "none">;
export type RelationshipChangeKind =
  | "unfollowed_you"
  | "you_unfollowed"
  | "blocked_you";
export type DisplayRelationship =
  | RelationshipKind
  | RelationshipChangeKind
  | "changed";

export const SOURCE_TYPES = [
  "profile",
  "following",
  "followers",
  "timeline",
  "search",
  "notifications",
  "thread",
  "unknown",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export const EVIDENCE_TYPES = [
  "blocked-notice",
  "blocked-interaction-restriction",
  "blocked-profile-summary-restriction",
  "following-control",
  "follow-control",
  "follows-you-label",
  "viewer-following-list",
  "viewer-followers-list",
  "page-user-entity",
  "insufficient-evidence",
] as const;

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export interface RelationshipFacts {
  following: boolean | null;
  followsYou: boolean | null;
  blockedBy: boolean;
}

export interface ObservationDraft {
  userKey: string;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  profileUrl: string;
  observedAt: number;
  sourceUrl: string;
  sourceType: SourceType;
  relationship: RelationshipKind;
  evidence: EvidenceType[];
}

export interface ObservationRecord extends ObservationDraft {
  id?: number;
}

export interface UserRecord {
  key: string;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  profileUrl: string;
  currentRelationship: RelationshipKind;
  previousRelationship: RelationshipKind | null;
  hasChanged: boolean;
  changeDetectedAt: number | null;
  firstSeenAt: number;
  lastSeenAt: number;
  observationCount: number;
  lastSourceUrl: string;
  lastSourceType: SourceType;
  latestEvidence: EvidenceType[];
}

export interface ObserverSettings {
  consentVersion: number;
  observerEnabled: boolean;
  showBadges: boolean;
  dockCollapsed: boolean;
  viewerHandle: string | null;
}

export interface ObservationSummary {
  total: number;
  followingOnly: number;
  blockedBy: number;
  changed: number;
}

export interface DatabaseExport {
  format: "not-brother";
  schemaVersion: 1;
  exportedAt: string;
  users: UserRecord[];
  observations: ObservationRecord[];
}

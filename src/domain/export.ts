import {
  EVIDENCE_TYPES,
  RELATIONSHIP_KINDS,
  SOURCE_TYPES,
  type DatabaseExport,
  type ObservationRecord,
  type UserRecord,
} from "./types";
import { relationshipPresentation, type AppLocale } from "../i18n";

const relationshipSet = new Set<string>(RELATIONSHIP_KINDS);
const sourceSet = new Set<string>(SOURCE_TYPES);
const evidenceSet = new Set<string>(EVIDENCE_TYPES);

export function createDatabaseExport(
  users: UserRecord[],
  observations: ObservationRecord[],
  now = new Date(),
): DatabaseExport {
  return {
    format: "not-brother",
    schemaVersion: 1,
    exportedAt: now.toISOString(),
    users,
    observations,
  };
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isHttpsUrl(value: unknown, hostname?: string): value is string {
  if (!isString(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (!hostname || url.hostname === hostname);
  } catch {
    return false;
  }
}

function isNullableHttpsUrl(value: unknown): value is string | null {
  return value === null || isHttpsUrl(value);
}

function isUserRecord(value: unknown): value is UserRecord {
  if (!value || typeof value !== "object") return false;
  const user = value as Partial<UserRecord>;
  return (
    isString(user.key) &&
    isString(user.handle) &&
    isNullableString(user.displayName) &&
    isNullableHttpsUrl(user.avatarUrl) &&
    isHttpsUrl(user.profileUrl, "x.com") &&
    isString(user.currentRelationship) &&
    relationshipSet.has(user.currentRelationship) &&
    (user.previousRelationship === null ||
      (isString(user.previousRelationship) && relationshipSet.has(user.previousRelationship))) &&
    typeof user.hasChanged === "boolean" &&
    (user.changeDetectedAt === null || isFiniteNumber(user.changeDetectedAt)) &&
    isFiniteNumber(user.firstSeenAt) &&
    isFiniteNumber(user.lastSeenAt) &&
    isPositiveInteger(user.observationCount) &&
    isHttpsUrl(user.lastSourceUrl, "x.com") &&
    isString(user.lastSourceType) &&
    sourceSet.has(user.lastSourceType) &&
    Array.isArray(user.latestEvidence) &&
    user.latestEvidence.every((item) => isString(item) && evidenceSet.has(item))
  );
}

function isObservationRecord(value: unknown): value is ObservationRecord {
  if (!value || typeof value !== "object") return false;
  const observation = value as Partial<ObservationRecord>;
  return (
    isString(observation.userKey) &&
    isString(observation.handle) &&
    isNullableString(observation.displayName) &&
    isNullableHttpsUrl(observation.avatarUrl) &&
    isHttpsUrl(observation.profileUrl, "x.com") &&
    isFiniteNumber(observation.observedAt) &&
    isHttpsUrl(observation.sourceUrl, "x.com") &&
    isString(observation.sourceType) &&
    sourceSet.has(observation.sourceType) &&
    isString(observation.relationship) &&
    relationshipSet.has(observation.relationship) &&
    Array.isArray(observation.evidence) &&
    observation.evidence.every((item) => isString(item) && evidenceSet.has(item)) &&
    (observation.id === undefined || isPositiveInteger(observation.id))
  );
}

export function parseDatabaseExport(value: unknown): DatabaseExport {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid Not Brother export: root object");
  }
  const payload = value as Partial<DatabaseExport>;
  if (payload.format !== "not-brother" || payload.schemaVersion !== 1) {
    throw new Error("Invalid Not Brother export: unsupported schema");
  }
  if (!isString(payload.exportedAt) || Number.isNaN(Date.parse(payload.exportedAt))) {
    throw new Error("Invalid Not Brother export: exportedAt");
  }
  if (!Array.isArray(payload.users) || !payload.users.every(isUserRecord)) {
    throw new Error("Invalid Not Brother export: users");
  }
  if (
    !Array.isArray(payload.observations) ||
    !payload.observations.every(isObservationRecord)
  ) {
    throw new Error("Invalid Not Brother export: observations");
  }
  return payload as DatabaseExport;
}

function csvCell(value: string | number | boolean | null): string {
  const text = value === null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function usersToCsv(users: UserRecord[], locale: AppLocale = "en"): string {
  const headings = [
    "handle",
    "display_name",
    "relationship",
    "relationship_label",
    "previous_relationship",
    "has_changed",
    "first_seen_at",
    "last_seen_at",
    "observation_count",
    "profile_url",
    "last_source_url",
  ];
  const rows = users.map((user) => [
    user.handle,
    user.displayName,
    user.currentRelationship,
    relationshipPresentation(locale, user.currentRelationship).label,
    user.previousRelationship,
    user.hasChanged,
    new Date(user.firstSeenAt).toISOString(),
    new Date(user.lastSeenAt).toISOString(),
    user.observationCount,
    user.profileUrl,
    user.lastSourceUrl,
  ]);
  return [headings, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

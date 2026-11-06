import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import type { ObservationDraft, ObservationRecord, UserRecord } from "../domain/types";
import { parseDatabaseExport } from "../domain/export";
import {
  LEGACY_VIEWER,
  NotBrotherDatabase,
  claimLegacyArchive,
  clearArchive,
  copyArchive,
  deleteHandleEverywhere,
  exportDatabase,
  getArchiveUsers,
  getObservationSummary,
  getUserHistory,
  getUserRecords,
  importDatabase,
  listArchiveScopes,
  upsertObservations,
} from "./database";

let counter = 0;
const opened: Dexie[] = [];

function databaseName(): string {
  counter += 1;
  return `not-brother-test-${counter}`;
}

function open(name: string): NotBrotherDatabase {
  const database = new NotBrotherDatabase(name);
  opened.push(database);
  return database;
}

afterEach(async () => {
  for (const database of opened.splice(0)) {
    database.close();
    await Dexie.delete(database.name);
  }
});

function user(key: string, patch: Partial<UserRecord> = {}): UserRecord {
  return {
    key,
    handle: key,
    displayName: null,
    avatarUrl: null,
    profileUrl: `https://x.com/${key}`,
    currentRelationship: "mutual",
    previousRelationship: null,
    hasChanged: false,
    changeDetectedAt: null,
    firstSeenAt: 1_000,
    lastSeenAt: 2_000,
    observationCount: 1,
    lastSourceUrl: "https://x.com/home",
    lastSourceType: "timeline",
    latestEvidence: ["following-control"],
    ...patch,
  };
}

function observation(key: string, patch: Partial<ObservationDraft> = {}): ObservationDraft {
  return {
    userKey: key,
    handle: key,
    displayName: null,
    avatarUrl: null,
    profileUrl: `https://x.com/${key}`,
    observedAt: 2_000,
    sourceUrl: "https://x.com/home",
    sourceType: "timeline",
    relationship: "mutual",
    evidence: ["following-control"],
    ...patch,
  };
}

describe("schema v1 to v3 migration", () => {
  it("copies the unscoped 0.5.x archive under the legacy owner and drops bogus route handles", async () => {
    const name = databaseName();
    const legacy = new Dexie(name);
    legacy.version(1).stores({
      users:
        "&key, handle, currentRelationship, hasChanged, firstSeenAt, lastSeenAt, lastSourceType",
      observations:
        "++id, userKey, observedAt, relationship, sourceType, [userKey+observedAt]",
    });
    await legacy.table<UserRecord>("users").bulkPut([
      user("alice"),
      user("logout", { currentRelationship: "blocked_by" }),
      user("ghost", { currentRelationship: "unknown" }),
    ]);
    await legacy.table<ObservationRecord>("observations").bulkAdd([
      { ...observation("alice"), observedAt: 1_500 },
      observation("alice"),
      observation("logout", { relationship: "blocked_by" }),
    ]);
    legacy.close();

    const database = open(name);
    await database.open();
    expect(database.verno).toBe(3);
    expect(database.tables.map((table) => table.name).toSorted())
      .toEqual(["accountObservations", "accountUsers"]);
    expect(await listArchiveScopes(database)).toEqual([{ viewer: LEGACY_VIEWER, userCount: 1 }]);
    expect(await database.accountObservations.count()).toBe(2);

    expect(await claimLegacyArchive("viewer_a", [], database)).toBe(1);
    expect(await listArchiveScopes(database)).toEqual([{ viewer: "viewer_a", userCount: 1 }]);
    expect((await getUserHistory("viewer_a", "alice", database)).map((item) => item.observedAt))
      .toEqual([2_000, 1_500]);
    expect(await claimLegacyArchive("viewer_b", [], database)).toBe(0);
  });
});

describe("per-account archives", () => {
  it("keeps the same handle apart for two signed-in accounts", async () => {
    const database = open(databaseName());
    await upsertObservations("viewer_a", [observation("carol")], database);
    await upsertObservations("viewer_b", [
      observation("carol", { relationship: "blocked_by", evidence: ["blocked-notice"] }),
    ], database);

    expect((await getUserRecords("viewer_a", ["carol"], [], database))[0]?.currentRelationship)
      .toBe("mutual");
    expect((await getUserRecords("viewer_b", ["carol"], [], database))[0]?.currentRelationship)
      .toBe("blocked_by");
    expect((await getObservationSummary("viewer_b", [], database)).blockedBy).toBe(1);
    expect((await getObservationSummary("viewer_a", [], database)).blockedBy).toBe(0);
  });

  it("excludes the viewer and every known own account from reads", async () => {
    const database = open(databaseName());
    await upsertObservations("viewer_a", [
      observation("viewer_b"),
      observation("dave"),
    ], database);

    expect((await getArchiveUsers("viewer_a", ["viewer_b"], database)).map((item) => item.key))
      .toEqual(["dave"]);
    expect(await getUserRecords("viewer_a", ["viewer_b", "dave"], ["viewer_b"], database))
      .toHaveLength(1);
    await deleteHandleEverywhere("viewer_b", database);
    expect(await getArchiveUsers("viewer_a", [], database)).toHaveLength(1);
  });

  it("copies an archive idempotently and keeps the source", async () => {
    const database = open(databaseName());
    await upsertObservations("viewer_a", [observation("erin"), observation("viewer_b")], database);

    expect(await copyArchive("viewer_a", "viewer_b", ["viewer_a", "viewer_b"], database)).toBe(1);
    expect(await copyArchive("viewer_a", "viewer_b", ["viewer_a", "viewer_b"], database)).toBe(1);
    expect((await getArchiveUsers("viewer_b", [], database)).map((item) => item.key)).toEqual(["erin"]);
    expect(await getUserHistory("viewer_b", "erin", database)).toHaveLength(1);
    expect(await getArchiveUsers("viewer_a", [], database)).toHaveLength(2);

    await clearArchive("viewer_a", database);
    expect(await listArchiveScopes(database)).toEqual([{ viewer: "viewer_b", userCount: 1 }]);
  });

  it("exports one account as schema v2 and imports it into another", async () => {
    const database = open(databaseName());
    await upsertObservations("viewer_a", [observation("frank")], database);
    const payload = parseDatabaseExport(
      JSON.parse(JSON.stringify(await exportDatabase("viewer_a", [], database))),
    );

    expect(payload.viewerHandle).toBe("viewer_a");
    expect(payload.users[0]).not.toHaveProperty("viewer");
    expect(await importDatabase("viewer_b", payload, [], database)).toBe(1);
    expect(await getUserHistory("viewer_b", "frank", database)).toHaveLength(1);
  });
});

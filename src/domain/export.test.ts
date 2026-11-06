import { describe, expect, it } from "vitest";
import { createDatabaseExport, parseDatabaseExport, usersToCsv } from "./export";
import type { ObservationRecord, UserRecord } from "./types";

const user: UserRecord = {
  key: "alice",
  handle: "Alice",
  displayName: "Alice, \"A\"",
  avatarUrl: null,
  profileUrl: "https://x.com/Alice",
  currentRelationship: "mutual",
  previousRelationship: null,
  hasChanged: false,
  changeDetectedAt: null,
  firstSeenAt: 1_000,
  lastSeenAt: 2_000,
  observationCount: 2,
  lastSourceUrl: "https://x.com/home",
  lastSourceType: "timeline",
  latestEvidence: ["following-control", "follows-you-label"],
};

const observation: ObservationRecord = {
  id: 1,
  userKey: "alice",
  handle: "Alice",
  displayName: "Alice, \"A\"",
  avatarUrl: null,
  profileUrl: "https://x.com/Alice",
  observedAt: 2_000,
  sourceUrl: "https://x.com/home",
  sourceType: "timeline",
  relationship: "mutual",
  evidence: ["following-control", "follows-you-label"],
};

describe("database export", () => {
  it("round-trips a schema v2 payload that names its account", () => {
    const payload = createDatabaseExport([user], [observation], "viewer", new Date("2026-08-17T00:00:00Z"));
    expect(payload).toMatchObject({ schemaVersion: 2, viewerHandle: "viewer" });
    expect(parseDatabaseExport(JSON.parse(JSON.stringify(payload)))).toEqual(payload);
  });

  it("still accepts a 0.5.x schema v1 backup without an account", () => {
    const legacy = {
      format: "not-brother",
      schemaVersion: 1,
      exportedAt: "2026-08-17T00:00:00.000Z",
      users: [user],
      observations: [observation],
    };
    expect(parseDatabaseExport(legacy)).toEqual(legacy);
  });

  it("rejects a schema v2 payload with an invalid account handle", () => {
    const payload = createDatabaseExport([user], [observation], "viewer");
    expect(() => parseDatabaseExport({ ...payload, viewerHandle: "<script>" }))
      .toThrow("Invalid Not Brother export: viewerHandle");
    expect(() => parseDatabaseExport({ ...payload, schemaVersion: 3 }))
      .toThrow("unsupported schema");
  });

  it("rejects unknown relationship values", () => {
    const payload = createDatabaseExport([user], [observation]);
    const invalid = { ...payload, users: [{ ...user, currentRelationship: "guessed" }] };
    expect(() => parseDatabaseExport(invalid)).toThrow("Invalid Not Brother export: users");
  });

  it("rejects records missing the relationship change timestamp field", () => {
    const payload = createDatabaseExport([user], [observation]);
    const { changeDetectedAt: _missing, ...invalidUser } = user;
    expect(() => parseDatabaseExport({ ...payload, users: [invalidUser] })).toThrow(
      "Invalid Not Brother export: users",
    );
  });

  it("rejects executable or off-site source URLs", () => {
    const payload = createDatabaseExport([user], [observation]);
    expect(() =>
      parseDatabaseExport({
        ...payload,
        users: [{ ...user, profileUrl: "javascript:alert(1)" }],
      }),
    ).toThrow("Invalid Not Brother export: users");
    expect(() =>
      parseDatabaseExport({
        ...payload,
        observations: [{ ...observation, sourceUrl: "https://example.com/" }],
      }),
    ).toThrow("Invalid Not Brother export: observations");
  });

  it("escapes commas and quotes in CSV", () => {
    const csv = usersToCsv([user], "zh-CN");
    expect(csv).toContain('"Alice, ""A"""');
    expect(csv).toContain('"互相关注"');
  });
});

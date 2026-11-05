import Dexie, { type Table } from "dexie";
import type {
  DatabaseExport,
  ObservationDraft,
  ObservationRecord,
  ObservationSummary,
  UserRecord,
} from "../domain/types";
import {
  isCollectableRelationship,
  isDisplayedUser,
  mergeUserObservation,
  shouldPersistObservation,
} from "../domain/relationships";
import { createDatabaseExport } from "../domain/export";
import { RESERVED_ROUTE_HANDLES } from "../domain/identity";

/**
 * Archive owner for rows copied from the unscoped 0.5.x tables. The service
 * worker hands them to the first known signed-in account (`claimLegacyArchive`).
 */
export const LEGACY_VIEWER = "";

/** A relationship record as seen from one signed-in X account (`viewer`). */
export interface StoredUser extends UserRecord {
  viewer: string;
}

export interface StoredObservation extends ObservationRecord {
  viewer: string;
}

export interface ArchiveScope {
  viewer: string;
  userCount: number;
}

const HANDLE_KEY_PATTERN = /^[a-z0-9_]{1,15}$/;
const reservedKeys = new Set(RESERVED_ROUTE_HANDLES);

function isArchivableKey(key: string): boolean {
  return HANDLE_KEY_PATTERN.test(key) && !reservedKeys.has(key);
}

export class NotBrotherDatabase extends Dexie {
  accountUsers!: Table<StoredUser, [string, string]>;
  accountObservations!: Table<StoredObservation, number>;

  constructor(name = "not-brother-v1") {
    super(name);
    // 0.1–0.5: one archive keyed by the other account's handle only.
    this.version(1).stores({
      users:
        "&key, handle, currentRelationship, hasChanged, firstSeenAt, lastSeenAt, lastSourceType",
      observations:
        "++id, userKey, observedAt, relationship, sourceType, [userKey+observedAt]",
    });
    // 0.6: one archive per signed-in account. IndexedDB upgrades cannot read
    // extension storage, so copied rows wait under LEGACY_VIEWER for a claim.
    this.version(2).stores({
      accountUsers:
        "&[viewer+key], viewer, key, [viewer+lastSeenAt], currentRelationship, hasChanged",
      accountObservations:
        "++id, viewer, userKey, relationship, [viewer+userKey], [viewer+userKey+observedAt]",
    }).upgrade(async (tx) => {
      const users = await tx.table<UserRecord>("users").toArray();
      const kept = users.filter((user) =>
        isArchivableKey(user.key) && isCollectableRelationship(user.currentRelationship));
      const keptKeys = new Set(kept.map((user) => user.key));
      await tx.table<StoredUser>("accountUsers").bulkPut(
        kept.map((user) => ({ ...user, viewer: LEGACY_VIEWER })),
      );
      const observations = await tx.table<ObservationRecord>("observations").toArray();
      await tx.table<StoredObservation>("accountObservations").bulkPut(
        observations
          .filter((observation) =>
            keptKeys.has(observation.userKey) &&
            isCollectableRelationship(observation.relationship))
          .map((observation) => ({ ...observation, viewer: LEGACY_VIEWER })),
      );
    });
    this.version(3).stores({ users: null, observations: null });
  }
}

export const db = new NotBrotherDatabase();

function excludedSet(excluded: Iterable<string | null | undefined>): Set<string> {
  const keys = new Set<string>();
  for (const key of excluded) if (key) keys.add(key.toLowerCase());
  return keys;
}

function withoutViewer<T extends { viewer: string }>(record: T): Omit<T, "viewer"> {
  const { viewer: _viewer, ...rest } = record;
  return rest;
}

function usersOf(database: NotBrotherDatabase, viewer: string) {
  return database.accountUsers.where("viewer").equals(viewer);
}

export async function upsertObservations(
  viewer: string,
  observations: ObservationDraft[],
  database = db,
): Promise<StoredUser[]> {
  const latestByUser = new Map<string, ObservationDraft>();
  for (const observation of observations) {
    if (!isCollectableRelationship(observation.relationship)) continue;
    if (!isArchivableKey(observation.userKey)) continue;
    const current = latestByUser.get(observation.userKey);
    if (!current || current.observedAt <= observation.observedAt) {
      latestByUser.set(observation.userKey, observation);
    }
  }

  return database.transaction("rw", database.accountUsers, database.accountObservations, async () => {
    const updated: StoredUser[] = [];
    for (const observation of latestByUser.values()) {
      const existing = await database.accountUsers.get([viewer, observation.userKey]);
      if (!shouldPersistObservation(observation, existing)) continue;
      const merged = mergeUserObservation(existing, observation);
      const user: StoredUser = { ...merged.user, viewer };
      await database.accountUsers.put(user);
      if (merged.appendHistory) {
        await database.accountObservations.add({ ...observation, viewer });
      }
      updated.push(user);
    }
    return updated;
  });
}

export async function acknowledgeRelationshipChange(
  viewer: string,
  userKey: string,
  database = db,
): Promise<void> {
  await database.accountUsers.update([viewer, userKey], { hasChanged: false });
}

export async function deleteUserRecord(
  viewer: string,
  userKey: string,
  database = db,
): Promise<void> {
  await database.transaction("rw", database.accountUsers, database.accountObservations, async () => {
    await database.accountUsers.delete([viewer, userKey]);
    await database.accountObservations
      .where("[viewer+userKey]")
      .equals([viewer, userKey])
      .delete();
  });
}

/** Remove one handle from every account's archive (used for the viewer's own accounts). */
export async function deleteHandleEverywhere(userKey: string, database = db): Promise<void> {
  const key = userKey.toLowerCase();
  await database.transaction("rw", database.accountUsers, database.accountObservations, async () => {
    await database.accountUsers.where("key").equals(key).delete();
    await database.accountObservations.where("userKey").equals(key).delete();
  });
}

export async function clearArchive(viewer: string, database = db): Promise<void> {
  await database.transaction("rw", database.accountUsers, database.accountObservations, async () => {
    await usersOf(database, viewer).delete();
    await database.accountObservations.where("viewer").equals(viewer).delete();
  });
}

export async function purgeUnknownObservations(database = db): Promise<void> {
  await database.transaction("rw", database.accountUsers, database.accountObservations, async () => {
    const unknownUsers = await database.accountUsers
      .where("currentRelationship")
      .equals("unknown")
      .toArray();
    await database.accountUsers.bulkDelete(
      unknownUsers.map((user): [string, string] => [user.viewer, user.key]),
    );
    await database.accountObservations.where("relationship").equals("unknown").delete();
    for (const user of unknownUsers) {
      await database.accountObservations
        .where("[viewer+userKey]")
        .equals([user.viewer, user.key])
        .delete();
    }
  });
}

/** Archives that hold at least one record, largest first. */
export async function listArchiveScopes(database = db): Promise<ArchiveScope[]> {
  const viewers = await database.accountUsers.orderBy("viewer").uniqueKeys();
  const scopes = await Promise.all(viewers.map(async (viewer) => ({
    viewer: String(viewer),
    userCount: await usersOf(database, String(viewer)).count(),
  })));
  return scopes
    .filter((scope) => scope.userCount > 0)
    .toSorted((a, b) => b.userCount - a.userCount || a.viewer.localeCompare(b.viewer));
}

export async function getArchiveUsers(
  viewer: string,
  excluded: Iterable<string | null | undefined> = [],
  database = db,
): Promise<StoredUser[]> {
  const skip = excludedSet([viewer, ...excluded]);
  const users = await database.accountUsers
    .where("[viewer+lastSeenAt]")
    .between([viewer, Dexie.minKey], [viewer, Dexie.maxKey])
    .reverse()
    .toArray();
  return users.filter((user) => !skip.has(user.key));
}

export async function getUserHistory(
  viewer: string,
  userKey: string,
  database = db,
): Promise<StoredObservation[]> {
  const records = await database.accountObservations
    .where("[viewer+userKey]")
    .equals([viewer, userKey])
    .toArray();
  return records.toSorted((a, b) => b.observedAt - a.observedAt);
}

export async function getObservationSummary(
  viewer: string,
  excluded: Iterable<string | null | undefined> = [],
  database = db,
): Promise<ObservationSummary> {
  const users = (await getArchiveUsers(viewer, excluded, database)).filter(isDisplayedUser);
  return {
    total: users.length,
    followingOnly: users.filter(
      (user) => user.currentRelationship === "following_only",
    ).length,
    blockedBy: users.filter(
      (user) => user.currentRelationship === "blocked_by",
    ).length,
    changed: users.filter((user) => user.hasChanged).length,
  };
}

export async function getUserRecords(
  viewer: string,
  userKeys: string[],
  excluded: Iterable<string | null | undefined> = [],
  database = db,
): Promise<StoredUser[]> {
  const skip = excludedSet([viewer, ...excluded]);
  const keys = [...new Set(userKeys)]
    .map((key) => key.toLowerCase())
    .filter((key) => isArchivableKey(key) && !skip.has(key))
    .slice(0, 500);
  if (keys.length === 0) return [];
  const users = await database.accountUsers.bulkGet(
    keys.map((key): [string, string] => [viewer, key]),
  );
  return users.filter((user): user is StoredUser =>
    user !== undefined && user.currentRelationship !== "unknown");
}

export async function exportDatabase(
  viewer: string,
  excluded: Iterable<string | null | undefined> = [],
  database = db,
): Promise<DatabaseExport> {
  const skip = excludedSet([viewer, ...excluded]);
  const [users, observations] = await Promise.all([
    usersOf(database, viewer).toArray(),
    database.accountObservations.where("viewer").equals(viewer).toArray(),
  ]);
  return createDatabaseExport(
    users
      .filter((user) => isCollectableRelationship(user.currentRelationship) && !skip.has(user.key))
      .map(withoutViewer),
    observations
      .filter((observation) =>
        observation.relationship !== "unknown" && !skip.has(observation.userKey))
      .map(withoutViewer),
    viewer || null,
  );
}

/**
 * Merge users and history into one account's archive with the import rules:
 * the newer summary wins, counts and change flags are kept, and history is
 * deduplicated by userKey + observedAt so repeating a merge is a no-op.
 * Returns the number of users written.
 */
async function mergeIntoArchive(
  viewer: string,
  users: UserRecord[],
  observations: ObservationRecord[],
  excluded: Iterable<string | null | undefined>,
  database: NotBrotherDatabase,
): Promise<number> {
  const skip = excludedSet([viewer, ...excluded]);
  return database.transaction("rw", database.accountUsers, database.accountObservations, async () => {
    let written = 0;
    const acceptedKeys = new Set<string>();
    for (const incoming of users) {
      const { viewer: _viewer, ...imported } = incoming as StoredUser;
      if (!isCollectableRelationship(imported.currentRelationship)) continue;
      if (!isArchivableKey(imported.key) || skip.has(imported.key)) continue;
      acceptedKeys.add(imported.key);
      const existing = await database.accountUsers.get([viewer, imported.key]);
      written += 1;
      if (!existing) {
        await database.accountUsers.put({ ...imported, viewer });
        continue;
      }
      const newest = imported.lastSeenAt > existing.lastSeenAt ? imported : existing;
      await database.accountUsers.put({
        ...newest,
        viewer,
        firstSeenAt: Math.min(existing.firstSeenAt, imported.firstSeenAt),
        lastSeenAt: Math.max(existing.lastSeenAt, imported.lastSeenAt),
        observationCount: Math.max(existing.observationCount, imported.observationCount),
        hasChanged: existing.hasChanged || imported.hasChanged,
      });
    }
    const additions: StoredObservation[] = [];
    const queuedKeys = new Set<string>();
    for (const incoming of observations) {
      const { id: _id, viewer: _viewer, ...observation } = incoming as StoredObservation;
      if (!isCollectableRelationship(observation.relationship)) continue;
      if (!acceptedKeys.has(observation.userKey)) {
        const known = await database.accountUsers.get([viewer, observation.userKey]);
        if (!known || skip.has(observation.userKey)) continue;
      }
      const observationKey = `${observation.userKey}\0${observation.observedAt}`;
      if (queuedKeys.has(observationKey)) continue;
      const duplicate = await database.accountObservations
        .where("[viewer+userKey+observedAt]")
        .equals([viewer, observation.userKey, observation.observedAt])
        .first();
      if (!duplicate) {
        queuedKeys.add(observationKey);
        additions.push({ ...observation, viewer });
      }
    }
    if (additions.length > 0) await database.accountObservations.bulkAdd(additions);
    return written;
  });
}

export async function importDatabase(
  viewer: string,
  payload: DatabaseExport,
  excluded: Iterable<string | null | undefined> = [],
  database = db,
): Promise<number> {
  return mergeIntoArchive(viewer, payload.users, payload.observations, excluded, database);
}

/** Copy one account's archive into another; the source archive is kept. */
export async function copyArchive(
  from: string,
  to: string,
  excluded: Iterable<string | null | undefined> = [],
  database = db,
): Promise<number> {
  if (from === to) return 0;
  const [users, observations] = await Promise.all([
    usersOf(database, from).toArray(),
    database.accountObservations.where("viewer").equals(from).toArray(),
  ]);
  return mergeIntoArchive(to, users, observations, excluded, database);
}

/**
 * Hand rows copied from the 0.5.x tables to a signed-in account. Returns the
 * number of users claimed (0 when nothing was waiting).
 */
export async function claimLegacyArchive(
  viewer: string,
  excluded: Iterable<string | null | undefined> = [],
  database = db,
): Promise<number> {
  if (!viewer || (await usersOf(database, LEGACY_VIEWER).count()) === 0) return 0;
  const claimed = await copyArchive(LEGACY_VIEWER, viewer, excluded, database);
  await clearArchive(LEGACY_VIEWER, database);
  return claimed;
}

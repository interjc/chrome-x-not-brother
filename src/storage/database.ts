import Dexie, { type EntityTable } from "dexie";
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

class NotBrotherDatabase extends Dexie {
  users!: EntityTable<UserRecord, "key">;
  observations!: EntityTable<ObservationRecord, "id">;

  constructor() {
    super("not-brother-v1");
    this.version(1).stores({
      users:
        "&key, handle, currentRelationship, hasChanged, firstSeenAt, lastSeenAt, lastSourceType",
      observations:
        "++id, userKey, observedAt, relationship, sourceType, [userKey+observedAt]",
    });
  }
}

export const db = new NotBrotherDatabase();

export async function upsertObservations(
  observations: ObservationDraft[],
): Promise<UserRecord[]> {
  const latestByUser = new Map<string, ObservationDraft>();
  for (const observation of observations) {
    if (!isCollectableRelationship(observation.relationship)) continue;
    const current = latestByUser.get(observation.userKey);
    if (!current || current.observedAt <= observation.observedAt) {
      latestByUser.set(observation.userKey, observation);
    }
  }

  return db.transaction("rw", db.users, db.observations, async () => {
    const updated: UserRecord[] = [];
    for (const observation of latestByUser.values()) {
      const existing = await db.users.get(observation.userKey);
      if (!shouldPersistObservation(observation, existing)) continue;
      const merged = mergeUserObservation(existing, observation);
      await db.users.put(merged.user);
      if (merged.appendHistory) await db.observations.add({ ...observation });
      updated.push(merged.user);
    }
    return updated;
  });
}

export async function acknowledgeRelationshipChange(userKey: string): Promise<void> {
  await db.users.update(userKey, { hasChanged: false });
}

export async function deleteUserRecord(userKey: string): Promise<void> {
  await db.transaction("rw", db.users, db.observations, async () => {
    await db.users.delete(userKey);
    await db.observations.where("userKey").equals(userKey).delete();
  });
}

export async function clearDatabase(): Promise<void> {
  await db.transaction("rw", db.users, db.observations, async () => {
    await Promise.all([db.users.clear(), db.observations.clear()]);
  });
}

export async function purgeUnknownObservations(): Promise<void> {
  await db.transaction("rw", db.users, db.observations, async () => {
    const unknownUserKeys = await db.users
      .where("currentRelationship")
      .equals("unknown")
      .primaryKeys();
    await Promise.all([
      db.users.bulkDelete(unknownUserKeys),
      db.observations.where("relationship").equals("unknown").delete(),
    ]);
    if (unknownUserKeys.length > 0) {
      await db.observations.where("userKey").anyOf(unknownUserKeys).delete();
    }
  });
}

export async function getObservationSummary(
  excludedUserKey: string | null = null,
): Promise<ObservationSummary> {
  const users = (await db.users.toArray()).filter((user) =>
    isDisplayedUser(user) &&
    (!excludedUserKey || user.key !== excludedUserKey),
  );
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
  userKeys: string[],
  excludedUserKey: string | null = null,
): Promise<UserRecord[]> {
  const keys = [...new Set(userKeys)]
    .map((key) => key.toLowerCase())
    .filter((key) => /^[a-z0-9_]{1,15}$/.test(key))
    .slice(0, 500);
  if (keys.length === 0) return [];
  const users = await db.users.bulkGet(keys);
  return users.filter((user): user is UserRecord => {
    if (!user) return false;
    return user.currentRelationship !== "unknown" &&
      (!excludedUserKey || user.key !== excludedUserKey);
  });
}

export async function exportDatabase(
  excludedUserKey: string | null = null,
): Promise<DatabaseExport> {
  const [users, observations] = await Promise.all([
    db.users.toArray(),
    db.observations.toArray(),
  ]);
  return createDatabaseExport(
    users.filter(
      (user) => isCollectableRelationship(user.currentRelationship) &&
        (!excludedUserKey || user.key !== excludedUserKey),
    ),
    observations.filter(
      (observation) => observation.relationship !== "unknown" &&
        (!excludedUserKey || observation.userKey !== excludedUserKey),
    ),
  );
}

export async function importDatabase(payload: DatabaseExport): Promise<void> {
  await db.transaction("rw", db.users, db.observations, async () => {
    for (const imported of payload.users) {
      if (!isCollectableRelationship(imported.currentRelationship)) continue;
      const existing = await db.users.get(imported.key);
      if (!existing) {
        await db.users.put(imported);
        continue;
      }
      const newest = imported.lastSeenAt > existing.lastSeenAt ? imported : existing;
      await db.users.put({
        ...newest,
        firstSeenAt: Math.min(existing.firstSeenAt, imported.firstSeenAt),
        lastSeenAt: Math.max(existing.lastSeenAt, imported.lastSeenAt),
        observationCount: Math.max(existing.observationCount, imported.observationCount),
        hasChanged: existing.hasChanged || imported.hasChanged,
      });
    }
    const observations: ObservationDraft[] = [];
    const queuedKeys = new Set<string>();
    for (const { id: _id, ...observation } of payload.observations) {
      if (!isCollectableRelationship(observation.relationship)) continue;
      const observationKey = `${observation.userKey}\0${observation.observedAt}`;
      if (queuedKeys.has(observationKey)) continue;
      const duplicate = await db.observations
        .where("[userKey+observedAt]")
        .equals([observation.userKey, observation.observedAt])
        .first();
      if (!duplicate) {
        queuedKeys.add(observationKey);
        observations.push(observation);
      }
    }
    if (observations.length > 0) await db.observations.bulkAdd(observations);
  });
}

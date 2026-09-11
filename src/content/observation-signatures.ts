import type { ObservationDraft, UserRecord } from "../domain/types";

export interface ObservationSignatureTracker {
  filterUnsent(observations: ObservationDraft[]): ObservationDraft[];
  markPersisted(observations: ObservationDraft[], users: UserRecord[]): void;
}

interface PersistedSignature {
  base: string;
  displayName: string | null;
  avatarUrl: string | null;
}

function baseSignature(observation: ObservationDraft): string {
  return JSON.stringify([
    observation.userKey,
    observation.relationship,
    observation.sourceUrl,
    observation.evidence.join("|"),
  ]);
}

export function createObservationSignatureTracker(): ObservationSignatureTracker {
  const persistedSignatures = new Map<string, PersistedSignature>();

  return {
    filterUnsent(observations): ObservationDraft[] {
      return observations.filter((observation) => {
        const persisted = persistedSignatures.get(observation.userKey);
        if (!persisted || persisted.base !== baseSignature(observation)) return true;
        if (
          observation.displayName !== null &&
          observation.displayName !== persisted.displayName
        ) return true;
        return observation.avatarUrl !== null && observation.avatarUrl !== persisted.avatarUrl;
      });
    },
    markPersisted(observations, users): void {
      const persistedUsers = new Map(users.map((user) => [user.key, user]));
      for (const observation of observations) {
        const user = persistedUsers.get(observation.userKey);
        if (!user) continue;
        persistedSignatures.set(observation.userKey, {
          base: baseSignature(observation),
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        });
      }
    },
  };
}

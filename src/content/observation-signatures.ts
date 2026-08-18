import type { ObservationDraft, UserRecord } from "../domain/types";

export interface ObservationSignatureTracker {
  filterUnsent(observations: ObservationDraft[]): ObservationDraft[];
  markPersisted(observations: ObservationDraft[], users: UserRecord[]): void;
}

function signature(observation: ObservationDraft): string {
  return [
    observation.userKey,
    observation.relationship,
    observation.sourceUrl,
    observation.evidence.join("|"),
  ].join("::");
}

export function createObservationSignatureTracker(): ObservationSignatureTracker {
  const persistedSignatures = new Map<string, string>();

  return {
    filterUnsent(observations): ObservationDraft[] {
      return observations.filter(
        (observation) =>
          persistedSignatures.get(observation.userKey) !== signature(observation),
      );
    },
    markPersisted(observations, users): void {
      const persistedUserKeys = new Set(users.map((user) => user.key));
      for (const observation of observations) {
        if (!persistedUserKeys.has(observation.userKey)) continue;
        persistedSignatures.set(observation.userKey, signature(observation));
      }
    },
  };
}

import { liveQuery } from "dexie";
import { useCallback, useEffect, useState } from "react";
import { filterRuleSetStatus, type FilterRuleSetStatus } from "../domain/filter-rule-matching";
import { emptyHideStats, type HideStats } from "../domain/hide-stats";
import type { ObserverSettings, UserRecord } from "../domain/types";
import { getArchiveUsers, listArchiveScopes, type ArchiveScope } from "../storage/database";
import {
  LEGACY_CLAIM_KEY,
  dismissLegacyClaim,
  getLegacyClaim,
  type LegacyArchiveClaim,
} from "../storage/account-archive";
import { getFilterRuleSet, isFilterRulesStorageChange } from "../storage/filter-rules";
import { getHideStats, isHideStatsStorageChange } from "../storage/hide-stats";
import {
  DEFAULT_SETTINGS,
  getSettings,
  isSettingsStorageChange,
  updateSettings,
} from "../storage/settings";

export function useUsers(
  viewer: string | null,
  excluded: readonly string[] = [],
): { users: UserRecord[]; loading: boolean } {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const excludedKey = excluded.join(",");

  useEffect(() => {
    if (viewer === null) {
      setUsers([]);
      setLoading(false);
      return undefined;
    }
    // Another account's list must not linger while this one loads.
    setUsers([]);
    setLoading(true);
    const skip = excludedKey ? excludedKey.split(",") : [];
    const subscription = liveQuery(() => getArchiveUsers(viewer, skip)).subscribe({
      next: (records) => {
        setUsers(records);
        setLoading(false);
      },
      error: (error) => {
        console.error("Could not read Not Brother users", error);
        setLoading(false);
      },
    });
    return () => subscription.unsubscribe();
  }, [viewer, excludedKey]);

  return { users, loading };
}

/** Every account that has an archive, largest first. */
export function useArchiveScopes(): ArchiveScope[] {
  const [scopes, setScopes] = useState<ArchiveScope[]>([]);

  useEffect(() => {
    const subscription = liveQuery(() => listArchiveScopes()).subscribe({
      next: setScopes,
      error: (error) => console.error("Could not list Not Brother archives", error),
    });
    return () => subscription.unsubscribe();
  }, []);

  return scopes;
}

export function useLegacyClaim(): {
  claim: LegacyArchiveClaim | null;
  dismiss: () => Promise<void>;
} {
  const [claim, setClaim] = useState<LegacyArchiveClaim | null>(null);

  useEffect(() => {
    let active = true;
    const load = (): void => {
      void getLegacyClaim().then(
        (next) => {
          if (active) setClaim(next);
        },
        () => undefined,
      );
    };
    const handleStorageChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ): void => {
      if (areaName === "local" && Object.prototype.hasOwnProperty.call(changes, LEGACY_CLAIM_KEY)) {
        load();
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChanged);
    load();
    return () => {
      active = false;
      chrome.storage.onChanged.removeListener(handleStorageChanged);
    };
  }, []);

  const dismiss = useCallback(async () => {
    await dismissLegacyClaim();
    setClaim((current) => current && { ...current, dismissed: true });
  }, []);

  return { claim, dismiss };
}

export function useObserverSettings(): {
  settings: ObserverSettings;
  settingsReady: boolean;
  setSettings: (patch: Partial<ObserverSettings>) => Promise<void>;
  setSetting: <Key extends keyof ObserverSettings>(
    key: Key,
    value: ObserverSettings[Key],
  ) => Promise<void>;
} {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsReady, setSettingsReady] = useState(false);

  useEffect(() => {
    let active = true;
    const handleStorageChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ): void => {
      if (!active || !isSettingsStorageChange(changes, areaName)) return;
      void getSettings().then(
        (next) => {
          if (!active) return;
          setSettings(next);
          setSettingsReady(true);
        },
        (error: unknown) => {
          if (!active) return;
          console.error("Could not refresh Not Brother settings", error);
        },
      );
    };

    chrome.storage.onChanged.addListener(handleStorageChanged);
    void getSettings().then(
      (next) => {
        if (!active) return;
        setSettings(next);
        setSettingsReady(true);
      },
      (error: unknown) => {
        if (!active) return;
        console.error("Could not read Not Brother settings", error);
        setSettingsReady(true);
      },
    );
    return () => {
      active = false;
      chrome.storage.onChanged.removeListener(handleStorageChanged);
    };
  }, []);

  const patchSettings = useCallback(async (patch: Partial<ObserverSettings>) => {
    const next = await updateSettings(patch);
    setSettings(next);
  }, []);

  const setSetting = useCallback(
    async <Key extends keyof ObserverSettings>(key: Key, value: ObserverSettings[Key]) => {
      await patchSettings({ [key]: value });
    },
    [patchSettings],
  );

  return { settings, settingsReady, setSettings: patchSettings, setSetting };
}

export function useFilterRuleStatus(
  viewerHandle: string | null | undefined,
  applying: boolean,
): { status: FilterRuleSetStatus | null; ready: boolean } {
  const [status, setStatus] = useState<FilterRuleSetStatus | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async (): Promise<void> => {
      try {
        const ruleSet = await getFilterRuleSet(viewerHandle);
        if (!active) return;
        setStatus(filterRuleSetStatus(ruleSet, applying));
        setReady(true);
      } catch {
        if (!active) return;
        setStatus(filterRuleSetStatus({ rules: [] }, applying));
        setReady(true);
      }
    };
    const handleStorageChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ): void => {
      if (!active || !isFilterRulesStorageChange(changes, areaName, viewerHandle)) return;
      void load();
    };
    chrome.storage.onChanged.addListener(handleStorageChanged);
    void load();
    return () => {
      active = false;
      chrome.storage.onChanged.removeListener(handleStorageChanged);
    };
  }, [applying, viewerHandle]);

  return { status, ready };
}

export function useHideStats(
  viewerHandle: string | null | undefined,
): { stats: HideStats; ready: boolean } {
  const [stats, setStats] = useState(emptyHideStats);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async (): Promise<void> => {
      try {
        const next = await getHideStats(viewerHandle);
        if (!active) return;
        setStats(next);
        setReady(true);
      } catch {
        if (!active) return;
        setStats(emptyHideStats());
        setReady(true);
      }
    };
    const handleStorageChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ): void => {
      if (!active || !isHideStatsStorageChange(changes, areaName, viewerHandle)) return;
      void load();
    };
    chrome.storage.onChanged.addListener(handleStorageChanged);
    void load();
    return () => {
      active = false;
      chrome.storage.onChanged.removeListener(handleStorageChanged);
    };
  }, [viewerHandle]);

  return { stats, ready };
}

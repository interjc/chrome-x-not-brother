import { liveQuery } from "dexie";
import { useCallback, useEffect, useState } from "react";
import { filterRuleSetStatus, type FilterRuleSetStatus } from "../domain/filter-rule-matching";
import { emptyHideStats, type HideStats } from "../domain/hide-stats";
import type { ObserverSettings, UserRecord } from "../domain/types";
import { db } from "../storage/database";
import { getFilterRuleSet, isFilterRulesStorageChange } from "../storage/filter-rules";
import { getHideStats, isHideStatsStorageChange } from "../storage/hide-stats";
import {
  DEFAULT_SETTINGS,
  getSettings,
  isSettingsStorageChange,
  updateSettings,
} from "../storage/settings";

export function useUsers(): { users: UserRecord[]; loading: boolean } {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const subscription = liveQuery(() => db.users.orderBy("lastSeenAt").reverse().toArray()).subscribe({
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
  }, []);

  return { users, loading };
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

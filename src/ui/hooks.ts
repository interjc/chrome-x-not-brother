import { liveQuery } from "dexie";
import { useCallback, useEffect, useState } from "react";
import type { ObserverSettings, UserRecord } from "../domain/types";
import { db } from "../storage/database";
import {
  coerceSettings,
  DEFAULT_SETTINGS,
  getSettings,
  SETTINGS_KEY,
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
      if (!active || areaName !== "local" || !changes[SETTINGS_KEY]) return;
      const saved = changes[SETTINGS_KEY].newValue as
        | Partial<ObserverSettings>
        | undefined;
      setSettings(coerceSettings(saved));
      setSettingsReady(true);
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

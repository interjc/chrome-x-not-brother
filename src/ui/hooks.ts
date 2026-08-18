import { liveQuery } from "dexie";
import { useCallback, useEffect, useState } from "react";
import type { ObserverSettings, UserRecord } from "../domain/types";
import { db } from "../storage/database";
import { DEFAULT_SETTINGS, getSettings, updateSettings } from "../storage/settings";

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
    void getSettings().then(
      (next) => {
        setSettings(next);
        setSettingsReady(true);
      },
      (error: unknown) => {
        console.error("Could not read Not Brother settings", error);
        setSettingsReady(true);
      },
    );
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

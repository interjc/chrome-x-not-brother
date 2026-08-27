import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ObserverSettings, UserRecord } from "../domain/types";

const testState = vi.hoisted(() => ({
  users: [] as UserRecord[],
  settings: {
    consentVersion: 3,
    observerEnabled: true,
    showBadges: true,
    dockCollapsed: false,
    viewerHandle: "viewer",
    uiLocale: "zh-CN",
    hideMutedAccounts: false,
    hideBlockedByAccounts: false,
    hideByFilterRules: false,
    sidePanelTab: "status",
  } as ObserverSettings,
}));

vi.mock("./hooks", async () => {
  const { useState } = await import("react");
  return {
    useUsers: () => ({ users: testState.users, loading: false }),
    useObserverSettings: () => {
      const [settings, setSettingsState] = useState(testState.settings);
      return {
        settings,
        settingsReady: true,
        setSettings: async (patch: Partial<ObserverSettings>) => {
          setSettingsState((current) => ({ ...current, ...patch }));
        },
        setSetting: async <Key extends keyof ObserverSettings>(
          key: Key,
          value: ObserverSettings[Key],
        ) => {
          setSettingsState((current) => ({ ...current, [key]: value }));
        },
      };
    },
  };
});

vi.mock("../storage/database", () => ({
  acknowledgeRelationshipChange: vi.fn(),
  clearDatabase: vi.fn(),
  db: {
    observations: {
      where: () => ({
        equals: () => ({
          toArray: async () => [],
        }),
      }),
    },
  },
  deleteUserRecord: vi.fn(),
  exportDatabase: vi.fn(),
  importDatabase: vi.fn(),
}));

function user(handle: string, displayName: string): UserRecord {
  return {
    key: handle.toLowerCase(),
    handle,
    displayName,
    avatarUrl: null,
    profileUrl: `https://x.com/${handle}`,
    currentRelationship: "following_only",
    previousRelationship: null,
    hasChanged: false,
    changeDetectedAt: null,
    firstSeenAt: 1,
    lastSeenAt: 2,
    observationCount: 1,
    lastSourceUrl: "https://x.com/home",
    lastSourceType: "timeline",
    latestEvidence: ["following-control"],
  };
}

describe("dashboard profile links", () => {
  beforeEach(async () => {
    window.location.hash = "";
    testState.users = [user("thsottiaux", "Tibo")];
    testState.settings = {
      consentVersion: 3,
      observerEnabled: true,
      showBadges: true,
      dockCollapsed: false,
      viewerHandle: "viewer",
      uiLocale: "zh-CN",
      hideMutedAccounts: false,
      hideBlockedByAccounts: false,
      hideByFilterRules: false,
      sidePanelTab: "status",
    };
    vi.stubGlobal("chrome", {
      i18n: { getUILanguage: () => "zh-CN" },
      runtime: {
        getManifest: () => ({ version: "0.4.9" }),
        sendMessage: vi.fn(),
      },
      storage: {
        local: {
          get: vi.fn(async () => ({})),
          set: vi.fn(async () => undefined),
        },
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
      permissions: { request: vi.fn(async () => true) },
    });
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    document.documentElement.lang = "";
    document.body.innerHTML = '<div id="root"></div>';
    vi.resetModules();
    await act(async () => {
      await import("./dashboard");
    });
  });

  it("opens the X profile from the avatar, display name, and handle", () => {
    const person = document.querySelector<HTMLAnchorElement>("a.user-record__person");
    expect(person?.href).toBe("https://x.com/thsottiaux");
    expect(person?.target).toBe("_blank");
    expect(person?.rel).toContain("noreferrer");
    expect(person?.querySelector("img")?.getAttribute("src")).toBe(
      "https://unavatar.io/x/thsottiaux",
    );
    expect(person?.textContent).toContain("Tibo");
    expect(person?.textContent).toContain("@thsottiaux");
  });

  it("opens the blacklist editor in place from the nearby filter action", async () => {
    const manager = document.querySelector<HTMLDetailsElement>("#filter-rules");
    expect(manager?.open).toBe(false);

    const editRules = document.querySelector<HTMLButtonElement>(
      ".local-settings .timeline-filters__edit-rules",
    );
    await act(async () => editRules?.click());

    expect(window.location.hash).toBe("#filter-rules");
    expect(manager?.open).toBe(true);
    expect(document.activeElement).toBe(manager?.querySelector("summary"));
  });
});

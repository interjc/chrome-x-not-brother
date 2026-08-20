import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ObserverSettings, UserRecord } from "../domain/types";

const defaultSettings: ObserverSettings = {
  consentVersion: 1,
  observerEnabled: true,
  showBadges: true,
  dockCollapsed: false,
  viewerHandle: "viewer",
  uiLocale: "auto",
};

const testState = vi.hoisted(() => ({
  users: [] as UserRecord[],
  sendMessage: vi.fn(),
  settings: {
    consentVersion: 1,
    observerEnabled: true,
    showBadges: true,
    dockCollapsed: false,
    viewerHandle: "viewer",
    uiLocale: "auto",
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

function user(
  handle: string,
  currentRelationship: UserRecord["currentRelationship"],
  hasChanged = false,
): UserRecord {
  return {
    key: handle.toLowerCase(),
    handle,
    displayName: `${handle} display`,
    avatarUrl: null,
    profileUrl: `https://x.com/${handle}`,
    currentRelationship,
    previousRelationship: hasChanged ? "mutual" : null,
    hasChanged,
    changeDetectedAt: hasChanged ? 2 : null,
    firstSeenAt: 1,
    lastSeenAt: 2,
    observationCount: 1,
    lastSourceUrl: "https://x.com/home",
    lastSourceType: "timeline",
    latestEvidence: ["following-control"],
  };
}

function recentProfileLinks(): HTMLAnchorElement[] {
  return [...document.querySelectorAll<HTMLAnchorElement>("a.recent-user")];
}

describe("SidePanel interactions", () => {
  beforeEach(async () => {
    testState.users = [
      user("MutualFriend", "mutual"),
      user("OneWay", "following_only"),
      user("BlockedAccount", "blocked_by", true),
      user("viewer", "mutual"),
    ];
    testState.sendMessage.mockReset();
    testState.settings = { ...defaultSettings };
    vi.stubGlobal("chrome", {
      i18n: { getUILanguage: () => "en" },
      runtime: { sendMessage: testState.sendMessage },
    });
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    document.documentElement.lang = "";
    document.body.innerHTML = '<div id="root"></div>';
    vi.resetModules();
    await act(async () => {
      await import("./sidepanel");
    });
  });

  it("filters from relationship counts and toggles the active filter back to all", async () => {
    expect(recentProfileLinks()).toHaveLength(3);
    const oneWay = document.querySelector<HTMLButtonElement>(
      ".mini-stat--following_only",
    );
    expect(oneWay?.getAttribute("aria-pressed")).toBe("false");

    await act(async () => oneWay?.click());

    expect(oneWay?.getAttribute("aria-pressed")).toBe("true");
    expect(recentProfileLinks().map((link) => link.textContent)).toEqual([
      expect.stringContaining("OneWay"),
    ]);
    expect(document.querySelector(".section-heading h1")?.textContent)
      .toBe("You follow only");

    await act(async () => oneWay?.click());

    expect(oneWay?.getAttribute("aria-pressed")).toBe("false");
    expect(recentProfileLinks()).toHaveLength(3);
  });

  it("filters changed users, renders an empty category, and uses safe profile links", async () => {
    const changed = document.querySelector<HTMLButtonElement>(".change-callout");
    await act(async () => changed?.click());
    expect(changed?.getAttribute("aria-pressed")).toBe("true");
    expect(recentProfileLinks()).toHaveLength(1);
    expect(recentProfileLinks()[0]?.href).toBe("https://x.com/BlockedAccount");
    expect(recentProfileLinks()[0]?.target).toBe("_blank");
    expect(recentProfileLinks()[0]?.rel).toContain("noreferrer");

    const followsYou = document.querySelector<HTMLButtonElement>(
      ".mini-stat--follows_you_only",
    );
    await act(async () => followsYou?.click());
    expect(recentProfileLinks()).toHaveLength(0);
    expect(document.querySelector(".empty-state--filtered")?.textContent)
      .toContain("No records in this category");
  });

  it("opens GitHub Issues from the footer feedback link", () => {
    const feedback = document.querySelector<HTMLAnchorElement>(".side-footer__feedback");
    expect(feedback?.href).toBe("https://github.com/interjc/chrome-x-not-brother/issues");
    expect(feedback?.target).toBe("_blank");
    expect(feedback?.rel).toContain("noreferrer");
    expect(feedback?.textContent).toBe("Send feedback");
  });

  it("defaults the language switcher to follow the browser language", () => {
    const select = document.querySelector<HTMLSelectElement>(".language-switch select");
    expect(select?.value).toBe("auto");
    expect(select?.selectedOptions[0]?.textContent).toBe("Match browser language");
    expect(document.documentElement.lang).toBe("en");
  });

  it("switches Side Panel copy when the user picks a language", async () => {
    const select = document.querySelector<HTMLSelectElement>(".language-switch select");
    await act(async () => {
      select!.value = "zh-CN";
      select!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(document.documentElement.lang).toBe("zh-CN");
    expect(document.querySelector(".brand__copy strong")?.textContent).toBe("不是兄弟");
    expect(document.querySelector(".section-heading h1")?.textContent).toBe("最近观察");
    expect(select?.selectedOptions[0]?.textContent).toBe("简体中文");
  });
});

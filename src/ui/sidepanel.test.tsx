import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserRecord } from "../domain/types";

const testState = vi.hoisted(() => ({
  users: [] as UserRecord[],
  sendMessage: vi.fn(),
}));

vi.mock("./hooks", () => ({
  useUsers: () => ({ users: testState.users, loading: false }),
  useObserverSettings: () => ({
    settings: {
      consentVersion: 1,
      observerEnabled: true,
      showBadges: true,
      dockCollapsed: false,
      viewerHandle: "viewer",
    },
    settingsReady: true,
    setSettings: vi.fn(),
    setSetting: vi.fn(),
  }),
}));

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
});

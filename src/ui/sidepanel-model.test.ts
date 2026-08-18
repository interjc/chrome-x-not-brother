import { describe, expect, it } from "vitest";
import type { UserRecord } from "../domain/types";
import {
  filterSidePanelUsers,
  toggleSidePanelFilter,
} from "./sidepanel-model";

function user(
  key: string,
  currentRelationship: UserRecord["currentRelationship"],
  hasChanged = false,
): UserRecord {
  return {
    key,
    handle: key,
    displayName: key,
    avatarUrl: null,
    profileUrl: `https://x.com/${key}`,
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

describe("side-panel relationship filters", () => {
  const users = [
    user("mutual", "mutual"),
    user("oneway", "following_only"),
    user("blocked", "blocked_by", true),
  ];

  it("filters base relationship categories and the aggregate changed category", () => {
    expect(filterSidePanelUsers(users, "following_only").map((item) => item.key))
      .toEqual(["oneway"]);
    expect(filterSidePanelUsers(users, "changed").map((item) => item.key))
      .toEqual(["blocked"]);
  });

  it("toggles the selected category back to all", () => {
    expect(toggleSidePanelFilter("all", "blocked_by")).toBe("blocked_by");
    expect(toggleSidePanelFilter("blocked_by", "blocked_by")).toBe("all");
  });
});

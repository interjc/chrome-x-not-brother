import { describe, expect, it } from "vitest";
import {
  removeRelationshipBadge,
  removeRelationshipBadges,
  setRelationshipBadge,
} from "./badge";

describe("relationship badge", () => {
  it("updates one DOM-safe badge instead of duplicating it", () => {
    const anchor = document.createElement("div");
    anchor.innerHTML = '<span>Name</span><a href="/Alice">@Alice</a>';
    setRelationshipBadge(anchor, "mutual", "Alice", "zh-CN");
    setRelationshipBadge(anchor, "changed", "Alice", "zh-CN");
    expect(anchor.querySelectorAll("[data-xro-badge]")).toHaveLength(1);
    expect(anchor.textContent).toContain("关系变化");
    expect(anchor.innerHTML).not.toContain("script");
    expect(anchor.querySelector("a + [data-xro-badge]")).not.toBeNull();
  });

  it("adds and removes a strong identity mark for blocked-by", () => {
    const anchor = document.createElement("div");
    anchor.innerHTML = '<a href="/Alice">@Alice</a>';
    setRelationshipBadge(anchor, "blocked_by", "Alice", "en");

    expect(anchor.dataset.xroRelationship).toBe("blocked_by");
    expect(anchor.classList.contains("xro-identity-mark--blocked_by")).toBe(true);
    removeRelationshipBadges(anchor);
    expect(anchor.hasAttribute("data-xro-relationship")).toBe(false);
    expect(anchor.querySelector("[data-xro-badge]")).toBeNull();
  });

  it("removes injected badges without touching the host content", () => {
    const root = document.createElement("div");
    root.textContent = "Host";
    setRelationshipBadge(root, "unknown", "Alice", "en");
    removeRelationshipBadges(root);
    expect(root.textContent).toBe("Host");
  });

  it("removes one stale unknown badge from its identity area", () => {
    const root = document.createElement("div");
    root.innerHTML = '<a href="/Alice">@Alice</a>';
    setRelationshipBadge(root, "unknown", "Alice", "en");
    removeRelationshipBadge(root);
    expect(root.textContent).toBe("@Alice");
  });
});

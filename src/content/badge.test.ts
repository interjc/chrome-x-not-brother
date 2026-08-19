import { describe, expect, it } from "vitest";
import {
  removeRelationshipBadge,
  removeRelationshipBadges,
  setRelationshipBadge,
} from "./badge";

describe("relationship badge", () => {
  it("updates one DOM-safe badge instead of duplicating it", () => {
    const anchor = document.createElement("div");
    anchor.innerHTML = '<span>Name</span><a href="/Alice"><span>@Alice</span></a>';
    setRelationshipBadge(anchor, "mutual", "Alice", "zh-CN");
    setRelationshipBadge(anchor, "changed", "Alice", "zh-CN");
    expect(anchor.querySelectorAll("[data-xro-badge]")).toHaveLength(1);
    expect(anchor.textContent).toContain("关系变化");
    expect(anchor.innerHTML).not.toContain("script");
    expect(anchor.querySelector("a + [data-xro-badge]")).not.toBeNull();
  });

  it("places a related-user badge under the avatar", () => {
    const cell = document.createElement("div");
    cell.setAttribute("data-testid", "UserCell");
    cell.innerHTML = `
      <div class="avatar-column">
        <a href="/mranti" data-testid="UserAvatar-Container-mranti">
          <img src="https://pbs.twimg.com/profile_images/1.jpg" alt="">
        </a>
      </div>
      <div data-testid="UserName">
        <div class="name-line"><a href="/mranti"><span>Michael Anti</span></a></div>
        <div class="handle-line"><span>@mranti</span></div>
      </div>
      <button>正在关注</button>
    `;

    const avatar = cell.querySelector<HTMLElement>("[data-testid='UserAvatar-Container-mranti']");
    setRelationshipBadge(avatar ?? cell, "mutual", "mranti", "zh-CN");

    const stack = cell.querySelector(".avatar-column");
    expect(stack?.classList.contains("xro-user-card-avatar-stack")).toBe(true);
    expect(stack?.querySelector("a + [data-xro-badge='mutual']")).not.toBeNull();
    expect(cell.querySelector("[data-xro-badge]")?.textContent).toBe("互关");
    expect(cell.querySelector("[data-testid='UserName'] [data-xro-badge]")).toBeNull();
  });

  it("places a home-timeline badge after the display name that links to the status permalink", () => {
    const anchor = document.createElement("div");
    anchor.innerHTML = `
      <a href="/Alice/status/1234567890123456789"><span>Alice Example</span></a>
      <a href="/Alice/status/1234567890123456789"><time>2h</time></a>
    `;

    setRelationshipBadge(anchor, "following_only", "Alice", "zh-CN");

    expect(anchor.querySelector("a[href='/Alice/status/1234567890123456789'] + [data-xro-badge]"))
      .not.toBeNull();
    expect(anchor.querySelector("time + [data-xro-badge]")).toBeNull();
  });

  it("keeps a reply-thread badge beside the display name instead of creating a second row", () => {
    const anchor = document.createElement("div");
    anchor.innerHTML = `
      <div class="identity-column">
        <a href="/Shiori_1001_"><span>シオリ</span></a>
      </div>
      <div class="metadata-row">
        <a href="/Shiori_1001_"><span>@Shiori_1001_</span></a><span>·</span><time>8月14日</time>
      </div>
    `;

    setRelationshipBadge(anchor, "blocked_by", "Shiori_1001_", "zh-CN");

    const row = anchor.querySelector<HTMLElement>("[data-xro-badge-row]");
    expect(row?.classList.contains("xro-name-badge-row")).toBe(true);
    expect(row?.querySelector("a + [data-xro-badge='blocked_by']")).not.toBeNull();
    expect(anchor.querySelector(".metadata-row [data-xro-badge]")).toBeNull();

    removeRelationshipBadge(anchor);
    expect(anchor.querySelector("[data-xro-badge-row]")).toBeNull();
    expect(anchor.querySelector(".xro-name-badge-row")).toBeNull();
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

  it("keeps a newly blocked change prominent while showing the event label", () => {
    const anchor = document.createElement("div");
    anchor.innerHTML = '<a href="/Alice">@Alice</a>';
    setRelationshipBadge(anchor, "blocked_you", "Alice", "zh-CN");

    expect(anchor.dataset.xroRelationship).toBe("blocked_you");
    expect(anchor.classList.contains("xro-identity-mark--blocked_by")).toBe(true);
    expect(anchor.querySelector("[data-xro-badge='blocked_you']")?.textContent).toBe("对方拉黑");
  });

  it("shows mutual instead of a follow-back event label", () => {
    const anchor = document.createElement("div");
    anchor.innerHTML = '<a href="/Alice">@Alice</a>';
    setRelationshipBadge(anchor, "mutual", "Alice", "zh-CN");

    expect(anchor.querySelector("[data-xro-badge='mutual']")?.textContent).toBe("互关");
  });

  it("marks one-way unfollow only when the viewer still follows", () => {
    const stillFollowing = document.createElement("div");
    stillFollowing.innerHTML = '<a href="/Alice">@Alice</a>';
    setRelationshipBadge(stillFollowing, "unfollowed_you", "Alice", "zh-CN", "following_only");
    expect(stillFollowing.classList.contains("xro-identity-mark--following_only")).toBe(true);

    const theyUnfollowed = document.createElement("div");
    theyUnfollowed.innerHTML = '<a href="/Bob">@Bob</a>';
    setRelationshipBadge(theyUnfollowed, "unfollowed_you", "Bob", "zh-CN", "none");
    expect(theyUnfollowed.querySelector("[data-xro-badge='unfollowed_you']")?.textContent).toBe("对方取关");
    expect(theyUnfollowed.classList.contains("xro-identity-mark--following_only")).toBe(false);
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

import { describe, expect, it } from "vitest";
import { applyPageStoreRelationships, type PageUserRelationship } from "./page-store";
import { setRelationshipBadge } from "./badge";
import { hidableTweetCell } from "./timeline-hide";
import {
  isInsideXUserAuthoredContent, observationAndBlockText, openTweetMoreMenu,
  postTextForCandidate, scanXDocument, tweetTextRootFrom, viewerHandleFromDocument,
} from "./x-adapter";

// Reduced, synthetic fixture of the no-testid X frontend observed in Chrome.
// Keep structural markers; no real account names, images or post bodies.
const viewer = '<nav aria-label="主要"><a href="/Viewer" aria-label="个人资料">Profile</a></nav>';
const name = (handle: string) => `<div class="x-middot-group"><div id="name-${handle}">
  <span><a href="/${handle}"><div>${handle} Example</div></a></span>
  <span><a href="/${handle}"><span>@${handle}</span></a></span>
  </div><span><a href="/${handle}/status/123">5m</a></span></div>`;
const avatar = (handle: string) => `<a href="/${handle}"><div class="x-avatar">
  <img alt="@${handle}" src="https://pbs.twimg.com/profile_images/123/${handle}_normal.jpg">
  </div></a>`;
const engagement = (disabled = false) => `<div role="group">${["reply", "retweet", "like"].map(action =>
  `<div data-engagement-action="${action}"><button ${disabled ? "disabled" : ""}>Action</button></div>`,
).join("")}</div>`;
const post = (handle: string, extra = "", disabled = false) => `<article>
  <div data-post-avatar="true">${avatar(handle)}</div>${name(handle)}
  <div dir="auto" class="whitespace-pre-wrap">Synthetic body <a href="/Mention">@Mention</a> has blocked you Follows you</div>
  ${engagement(disabled)}${extra}</article>`;
const fixture = (html: string) => new DOMParser().parseFromString(`${viewer}${html}`, "text/html");
const entity = (handle: string, following = true, followsYou = true): PageUserRelationship => ({
  handle, following, followsYou, blockedBy: false, muting: null, displayName: null, avatarUrl: null,
});
const hover = (handle: string, counts = true, label = "取消关注") => `<div data-base-ui-portal>
  <div role="presentation"><div data-base-ui-focusable data-open>
    ${avatar(handle)}${name(handle)}<span>关注了你</span>
    <div dir="auto" class="whitespace-pre-wrap">Synthetic bio has blocked you</div>
    <button data-slot="xds-button" aria-label="${label} @${handle}">${label}</button>
    ${counts ? `<a href="/${handle}/following">3 Following</a><a href="/${handle}/verified_followers">4 Followers</a>` : ""}
  </div></div></div>`;

describe("X frontend without data-testid", () => {
  it.each([["Profile", "Primary"], ["プロフィール", "メイン"], ["个人资料", "主要"]])(
    "recognizes the signed-in account using the %s navigation label", (label, nav) => {
      const doc = fixture(`<a href="/Stranger" aria-label="${label}">Stranger</a>`);
      doc.querySelector("nav")!.setAttribute("aria-label", nav);
      doc.querySelector("nav a")!.setAttribute("aria-label", label);
      expect(viewerHandleFromDocument(doc)).toBe("Viewer");
    },
  );

  it("ignores hidden navigation and never falls back to arbitrary profile links", () => {
    const doc = fixture('<a href="/Stranger" aria-label="Profile">Stranger</a>');
    doc.querySelector("nav")!.hidden = true;
    expect(viewerHandleFromDocument(doc)).toBeNull();
  });

  it("extracts only post authors, with matching identity and transient body text", () => {
    const doc = fixture(post("Alice") + post("Viewer"));
    const candidates = scanXDocument(doc, "https://x.com/home");
    expect(candidates.map(c => c.observation.handle)).toEqual(["Alice"]);
    const candidate = candidates[0]!;
    expect(candidate.observation.relationship).toBe("unknown");
    expect(candidate.observation.displayName).toBe("Alice Example");
    expect(candidate.observation.avatarUrl).toContain("Alice_x96.jpg");
    expect(postTextForCandidate(candidate.anchor)).toContain("Synthetic body");
    expect(isInsideXUserAuthoredContent(doc.querySelector('a[href="/Mention"]')!)).toBe(true);
    expect(tweetTextRootFrom(doc.querySelector('a[href="/Mention"]')!)).not.toBeNull();
    expect(observationAndBlockText(doc.querySelector("article")!).block).not.toContain("has blocked you");
  });

  it("does not borrow the identity of a nested profile preview", () => {
    const doc = fixture(post("Alice", `<div role="link" data-href="/Quoted">${avatar("Quoted")}${name("Quoted")}</div>`));
    expect(scanXDocument(doc, "https://x.com/home").map(c => [c.observation.handle, c.observation.avatarUrl]))
      .toEqual([
        ["Alice", "https://pbs.twimg.com/profile_images/123/Alice_x96.jpg"],
        ["Quoted", "https://pbs.twimg.com/profile_images/123/Quoted_x96.jpg"],
      ]);
  });

  it("collapses the complete modern post row without hiding a profile or hover card", () => {
    const doc = fixture(`<div role="link" data-href="/Alice/status/123">${post("Alice")}</div>` + hover("Bob"));
    const candidates = scanXDocument(doc, "https://x.com/home");
    expect(hidableTweetCell(candidates[0]!.anchor)?.getAttribute("data-href")).toBe("/Alice/status/123");
    expect(hidableTweetCell(candidates[1]!.anchor)).toBeNull();
  });

  it("enriches visible authors from page evidence and places a badge before the handle", () => {
    const doc = fixture(post("Alice"));
    const candidates = scanXDocument(doc, "https://x.com/notifications");
    applyPageStoreRelationships(candidates, new Map([["alice", entity("Alice")]]));
    expect(candidates[0]!.observation.relationship).toBe("mutual");
    setRelationshipBadge(candidates[0]!.anchor, "mutual", "Alice", "en");
    expect(doc.querySelector('[data-xro-badge]')?.nextElementSibling?.getAttribute("href")).toBe("/Alice");
    expect(hidableTweetCell(candidates[0]!.anchor)).toBe(doc.querySelector("article"));
  });

  it("keeps suggestion Follow controls partial and rejects negative page fills", () => {
    const doc = fixture(`<div role="link" data-href="/Alice">${avatar("Alice")}${name("Alice")}
      <button data-slot="xds-button" aria-label="关注 @Alice">关注</button></div>`);
    const candidates = scanXDocument(doc, "https://x.com/home");
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.facts).toMatchObject({ following: false, followsYou: null });
    applyPageStoreRelationships(candidates, new Map([["alice", entity("Alice", false, false)]]));
    expect(candidates[0]!.observation.relationship).toBe("unknown");
  });

  it("does not treat notification action history as a current relationship", () => {
    const doc = fixture(`<div id="urt:notifications:All"><div role="link" data-href="/Alice">
      ${avatar("Alice")}<a href="/Alice">Alice Example</a>
      <div dir="auto" class="whitespace-pre-wrap">Follows you</div>
      </div></div>`);
    const candidates = scanXDocument(doc, "https://x.com/notifications");
    expect(candidates.map(c => c.observation.handle)).toEqual(["Alice"]);
    expect(candidates[0]!.observation.relationship).toBe("unknown");
    applyPageStoreRelationships(candidates, new Map([["alice", entity("Alice", true, false)]]));
    expect(candidates[0]!.observation.relationship).toBe("following_only");
  });

  it("keeps grouped notification actors independent", () => {
    const doc = fixture(`<div id="urt:notifications:All"><div role="link" data-href="/Alice">
      ${avatar("Alice")}${avatar("Bob")}<a href="/Preview/status/2">Preview</a>
      <button data-slot="xds-button" aria-label="关注 @Alice">关注</button></div></div>`);
    const candidates = scanXDocument(doc, "https://x.com/notifications");
    expect(candidates.map(c => c.observation.handle)).toEqual(["Alice", "Bob"]);
    expect(candidates.every(c => c.observation.relationship === "unknown")).toBe(true);
  });

  it.each([
    ['aria-hidden="true"', '<span data-xro-badge="mutual">Mutual</span>'],
    ['aria-hidden="true"', 'Alice Example'],
    ['hidden', 'Alice Example'],
    ['inert', 'Alice Example'],
    ['', ''],
  ])("skips a notification navigation overlay (%s) when placing the actor badge", (attributes, content) => {
    const doc = fixture(`<div id="urt:notifications:All"><div role="link" data-href="/Alice">
      <a ${attributes} class="absolute inset-0 pointer-events-none" href="/Alice" tabindex="-1">${content}</a>
      <div>${avatar("Alice")}<div dir="auto" class="whitespace-pre-wrap inline">
        <div class="inline-flex"><span><a href="/Alice"><span>Alice Example</span></a></span></div>
        <span>关注了你 · 4小时</span></div></div>
      </div></div>`);
    const [candidate] = scanXDocument(doc, "https://x.com/notifications");
    const nameLink = doc.querySelector<HTMLElement>('a:has(> span:not([data-xro-badge]))')!;
    expect(candidate?.anchor).toBe(nameLink);
    expect(candidate?.observation.displayName).toBe("Alice Example");
    expect(candidate?.observation.relationship).toBe("unknown");

    applyPageStoreRelationships([candidate!], new Map([["alice", entity("Alice")]]));
    setRelationshipBadge(candidate!.anchor, "mutual", "Alice", "zh-CN");
    const [again] = scanXDocument(doc, "https://x.com/notifications");
    expect(again?.anchor).toBe(nameLink);
    setRelationshipBadge(again!.anchor, "mutual", "Alice", "zh-CN");
    expect(nameLink.querySelectorAll('[data-xro-badge="mutual"]')).toHaveLength(1);
    expect(nameLink.textContent).toBe("Alice Example互关");
  });

  it("uses the notification avatar when its only other profile link is a hidden overlay", () => {
    const doc = fixture(`<div id="urt:notifications:All"><div role="link" data-href="/Alice">
      <a aria-hidden="true" class="absolute inset-0 pointer-events-none" href="/Alice" tabindex="-1"></a>
      ${avatar("Alice")}<span>and 2 others liked your post</span>
      </div></div>`);
    const [candidate] = scanXDocument(doc, "https://x.com/notifications");
    expect(candidate?.anchor.querySelector(".x-avatar")).not.toBeNull();
    setRelationshipBadge(candidate!.anchor, "mutual", "Alice", "en");
    expect(doc.querySelector('a[aria-hidden] [data-xro-badge]')).toBeNull();
    expect(candidate!.anchor.querySelector('[data-xro-badge]')).not.toBeNull();
  });

  it.each([
    'dir="auto" class="whitespace-pre-wrap"',
    'data-testid="tweetText" dir="auto" class="whitespace-pre-wrap inline"',
  ])("never uses a notification post-preview mention as the actor name (%s)", attributes => {
    const doc = fixture(`<div id="urt:notifications:All"><div role="link" data-href="/Alice">
      ${avatar("Alice")}<div ${attributes}><a href="/Alice"><span>@Alice</span></a>
      <a href="/Mention">@Mention</a></div></div></div>`);
    const candidates = scanXDocument(doc, "https://x.com/notifications");
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.observation.handle).toBe("Alice");
    expect(candidates[0]?.anchor.querySelector(".x-avatar")).not.toBeNull();
  });

  it("requires all three real disabled controls and a same-layer actionable baseline", () => {
    const doc = fixture(post("Alice", "", true) + post("Bob"));
    const candidates = scanXDocument(doc, "https://x.com/Bob/status/123");
    expect(candidates[0]!.observation.relationship).toBe("blocked_by");
    expect(candidates[1]!.observation.relationship).toBe("unknown");
    doc.querySelector('article [data-engagement-action="reply"]')!.remove();
    expect(scanXDocument(doc, "https://x.com/Bob/status/123")[0]!.observation.relationship).toBe("unknown");
  });

  it("finds the open post more menu without confusing a share menu", () => {
    const doc = fixture(post("Alice", `<button data-slot="xds-menu-trigger" aria-label="更多" aria-expanded="true"></button>
      <div role="menu" data-slot="xds-menu-content"><div role="menuitem">Report</div></div>`));
    expect(openTweetMoreMenu(doc)?.handle).toBe("Alice");
    doc.querySelector('button[aria-label="更多"]')!.setAttribute("aria-label", "分享");
    expect(openTweetMoreMenu(doc)).toBeNull();
  });

  it("matches a loaded hover card to exactly one author and ignores its bio", () => {
    const doc = fixture(post("Alice") + post("Bob") + hover("Alice"));
    const candidates = scanXDocument(doc, "https://x.com/home");
    expect(candidates.map(c => [c.observation.handle, c.observation.relationship]))
      .toEqual([["Alice", "mutual"], ["Bob", "unknown"]]);
    doc.querySelector('[data-base-ui-focusable]')!.setAttribute("aria-hidden", "true");
    expect(scanXDocument(doc, "https://x.com/home").every(c => c.observation.relationship === "unknown")).toBe(true);
  });

  it("reads the matching profile header, excluding nested posts and stale headers", () => {
    const doc = fixture(`<main><div><span><h1>Alice Example</h1></span>
      <span><span>@Alice</span><div>关注了你</div></span></div>
      <a href="/Alice/photo"><div class="x-avatar"><img src="https://pbs.twimg.com/profile_images/123/Alice_normal.jpg"></div></a>
      <div dir="auto" class="whitespace-pre-wrap">Bio has blocked you</div>
      <button data-slot="xds-button" aria-label="取消关注 @Alice">正在关注</button>
      ${post("Bob", '<button data-slot="xds-button" aria-label="关注 @Bob">关注</button>')}
      </main>`);
    const alice = scanXDocument(doc, "https://x.com/Alice").find(c => c.observation.handle === "Alice");
    expect(alice?.observation.relationship).toBe("mutual");
    expect(alice?.observation.displayName).toBe("Alice Example");
    expect(scanXDocument(doc, "https://x.com/Other").some(c => c.observation.handle === "Other")).toBe(false);
    doc.querySelector("main > div > span + span > div")!.remove();
    expect(scanXDocument(doc, "https://x.com/Alice").find(c => c.observation.handle === "Alice")?.observation.relationship)
      .toBe("following_only");
  });

  it("preserves the count-less loaded hover restriction path and excludes account menus", () => {
    const doc = fixture(post("Alice") + hover("Alice", false));
    expect(scanXDocument(doc, "https://x.com/Viewer/status/123")[0]!.observation.relationship).toBe("blocked_by");
    doc.querySelector('[data-base-ui-focusable]')!.insertAdjacentHTML("beforeend", '<a href="/logout">Log out</a>');
    expect(scanXDocument(doc, "https://x.com/Viewer/status/123")[0]!.observation.relationship).toBe("unknown");
  });
});

import { describe, expect, it } from "vitest";
import {
  scanXDocument,
  sourceTypeFromUrl,
  viewerHandleFromDocument,
} from "./x-adapter";

function fixture(body: string): Document {
  return new DOMParser().parseFromString(`<html><body>${body}</body></html>`, "text/html");
}

function accountSwitcher(handle = "Viewer"): string {
  return `<div data-testid="SideNav_AccountSwitcher_Button"><span>@${handle}</span></div>`;
}

describe("sourceTypeFromUrl", () => {
  it("only treats the viewer's own relationship lists as authoritative", () => {
    expect(sourceTypeFromUrl(new URL("https://x.com/Viewer/following"), "viewer")).toBe("following");
    expect(sourceTypeFromUrl(new URL("https://x.com/Other/following"), "viewer")).toBe("unknown");
  });

  it("treats a photo lightbox as the underlying thread", () => {
    expect(sourceTypeFromUrl(
      new URL("https://x.com/Someone/status/123/photo/1"),
      "viewer",
    )).toBe("thread");
  });
});

describe("viewerHandleFromDocument", () => {
  it("uses the signed-in account switcher instead of the current page author", () => {
    const doc = fixture(`${accountSwitcher("interjc")}
      <a data-testid="AppTabBar_Profile_Link" href="/interjc">Profile</a>
      <article><div data-testid="UserName"><a href="/iamcheyan">@iamcheyan</a></div></article>`);

    expect(viewerHandleFromDocument(doc)).toBe("interjc");
  });
});

describe("scanXDocument", () => {
  it("reads an English mutual relationship from a UserCell", () => {
    const doc = fixture(`${accountSwitcher()}<div data-testid="UserCell">
      <div data-testid="UserName"><span>Alice Example</span><span>@Alice</span></div>
      <span>Follows you</span><button data-testid="123-unfollow">Following</button>
    </div>`);
    const [candidate] = scanXDocument(doc, "https://x.com/Viewer/following", 100);
    expect(candidate?.observation).toMatchObject({ handle: "Alice", relationship: "mutual" });
  });

  it("reads a Japanese one-way following relationship", () => {
    const doc = fixture(`${accountSwitcher()}<div data-testid="UserCell">
      <div data-testid="UserName"><span>アリス</span><span>@Alice</span></div>
      <button data-testid="123-unfollow">フォロー中</button>
    </div>`);
    const [candidate] = scanXDocument(doc, "https://x.com/Viewer/following", 100);
    expect(candidate?.observation.relationship).toBe("following_only");
  });

  it("reads explicit neither-following on a UserCell as none", () => {
    const doc = fixture(`${accountSwitcher()}<div data-testid="UserCell">
      <div data-testid="UserName"><span>Alice Example</span><span>@Alice</span></div>
      <button data-testid="123-follow">Follow</button>
    </div>`);
    const [candidate] = scanXDocument(doc, "https://x.com/search?q=alice", 100);
    expect(candidate?.observation.relationship).toBe("none");
  });

  it("reads a Simplified Chinese follows-you-only relationship", () => {
    const doc = fixture(`${accountSwitcher()}<div data-testid="UserCell">
      <div data-testid="UserName"><span>小明</span><span>@XiaoMing</span></div>
      <span>关注了你</span><button data-testid="456-follow">关注</button>
    </div>`);
    const [candidate] = scanXDocument(doc, "https://x.com/Viewer/followers", 100);
    expect(candidate?.observation.relationship).toBe("follows_you_only");
  });

  it("records a blocked profile only from an explicit localized notice", () => {
    const doc = fixture(`<main data-testid="primaryColumn">
      <div data-testid="UserName"><span>迷惑账号</span><span>@BlockedUser</span></div>
      <p>你已被拉黑，无法关注此账号。</p>
    </main>`);
    const candidates = scanXDocument(doc, "https://x.com/BlockedUser", 100);
    expect(candidates.some((candidate) => candidate.observation.relationship === "blocked_by")).toBe(true);
  });

  it("keeps a timeline card unknown when it has no relationship evidence", () => {
    const doc = fixture(`<article data-testid="tweet">
      <div data-testid="UserName"><span>Alice Example</span><span>@Alice</span></div>
    </article>`);
    const [candidate] = scanXDocument(doc, "https://x.com/home", 100);
    expect(candidate?.observation.relationship).toBe("unknown");
    expect(candidate?.observation.evidence).toEqual(["insufficient-evidence"]);
  });

  it("recognizes an explicit blocked-by notice inside a reply article", () => {
    const doc = fixture(`${accountSwitcher()}<article data-testid="tweet">
      <div data-testid="User-Name"><span>Reply Author</span><a href="/ReplyBlocker">@ReplyBlocker</a></div>
      <div>This Post is from an account that has blocked you.</div>
    </article>`);
    const [candidate] = scanXDocument(doc, "https://x.com/Someone/status/123", 100);
    expect(candidate?.observation).toMatchObject({
      handle: "ReplyBlocker",
      relationship: "blocked_by",
      sourceType: "thread",
    });
  });

  it("reads a blocked notice placed beside the reply article in the same virtualized cell", () => {
    const doc = fixture(`${accountSwitcher()}<div data-testid="cellInnerDiv">
      <article data-testid="tweet">
        <div data-testid="User-Name"><span>Shiori</span><a href="/Shiori_1001_">@Shiori_1001_</a></div>
      </article>
      <div>This post is from an account that blocked you.</div>
    </div>`);
    const [candidate] = scanXDocument(
      doc,
      "https://x.com/iamcheyan/status/2088218040643256589",
      100,
    );
    expect(candidate?.observation).toMatchObject({
      handle: "Shiori_1001_",
      relationship: "blocked_by",
      evidence: ["blocked-notice"],
    });
  });

  it("recognizes a reply whose reply, repost, and like controls are all disabled", () => {
    const doc = fixture(`${accountSwitcher()}
      <article data-testid="tweet">
        <div data-testid="User-Name"><span>Normal</span><a href="/Normal">@Normal</a></div>
        <button data-testid="reply"></button>
        <button data-testid="retweet"></button>
        <button data-testid="like"></button>
      </article>
      <div data-testid="cellInnerDiv">
        <article data-testid="tweet">
          <div data-testid="User-Name"><span>Shiori</span><a href="/Shiori_1001_">@Shiori_1001_</a></div>
          <div data-testid="reply" aria-disabled="true"><button></button></div>
          <button data-testid="retweet" aria-disabled="true"></button>
          <div data-testid="like" aria-disabled="true"><span aria-hidden="true"></span></div>
        </article>
      </div>`);
    const candidate = scanXDocument(
      doc,
      "https://x.com/iamcheyan/status/2088218040643256589",
      100,
    ).find((item) => item.observation.handle === "Shiori_1001_");
    expect(candidate?.observation).toMatchObject({
      relationship: "blocked_by",
      evidence: ["blocked-interaction-restriction"],
    });
  });

  it("reads interaction restrictions from ancestors outside the testid buttons", () => {
    const doc = fixture(`${accountSwitcher()}
      <article data-testid="tweet">
        <div data-testid="User-Name"><span>Normal</span><a href="/Normal">@Normal</a></div>
        <button data-testid="reply"></button>
        <button data-testid="retweet"></button>
        <button data-testid="like"></button>
      </article>
      <div data-testid="cellInnerDiv">
        <article data-testid="tweet">
          <div data-testid="User-Name"><span>Blocked</span><a href="/Blocked">@Blocked</a></div>
          <div aria-disabled="true">
            <button data-testid="reply"></button>
            <button data-testid="retweet"></button>
            <button data-testid="like"></button>
          </div>
        </article>
      </div>`);
    const candidate = scanXDocument(doc, "https://x.com/Someone/status/123", 100)
      .find((item) => item.observation.handle === "Blocked");

    expect(candidate?.observation).toMatchObject({
      relationship: "blocked_by",
      evidence: ["blocked-interaction-restriction"],
    });
  });

  it("does not infer blocked-by from missing engagement without a normal-page baseline", () => {
    const doc = fixture(`<div data-testid="cellInnerDiv"><article data-testid="tweet">
      <div data-testid="User-Name"><span>Restricted</span><a href="/Restricted">@Restricted</a></div>
    </article></div>`);
    const [candidate] = scanXDocument(doc, "https://x.com/Someone/status/123", 100);
    expect(candidate?.observation.relationship).toBe("unknown");
  });

  it("does not treat unrendered engagement controls as disabled even with a normal baseline", () => {
    const doc = fixture(`${accountSwitcher()}
      <article data-testid="tweet">
        <div data-testid="User-Name"><span>Normal</span><a href="/Normal">@Normal</a></div>
        <button data-testid="reply"></button>
        <button data-testid="retweet"></button>
        <button data-testid="like"></button>
      </article>
      <div data-testid="cellInnerDiv">
        <article data-testid="tweet">
          <div data-testid="User-Name"><span>Unrendered</span><a href="/Unrendered">@Unrendered</a></div>
        </article>
      </div>`);
    const candidate = scanXDocument(doc, "https://x.com/Someone/status/123", 100)
      .find((item) => item.observation.handle === "Unrendered");

    expect(candidate?.observation.relationship).toBe("unknown");
  });

  it("does not treat empty engagement shells as disabled even with a normal baseline", () => {
    const doc = fixture(`${accountSwitcher()}
      <article data-testid="tweet">
        <div data-testid="User-Name"><span>Normal</span><a href="/Normal">@Normal</a></div>
        <button data-testid="reply"></button>
        <button data-testid="retweet"></button>
        <button data-testid="like"></button>
      </article>
      <div data-testid="cellInnerDiv">
        <article data-testid="tweet">
          <div data-testid="User-Name"><span>Recycling</span><a href="/Recycling">@Recycling</a></div>
          <div data-testid="reply"></div>
          <div data-testid="retweet"></div>
          <div data-testid="like"></div>
        </article>
      </div>`);
    const candidate = scanXDocument(doc, "https://x.com/Someone/status/123/photo/1", 100)
      .find((item) => item.observation.handle === "Recycling");

    expect(candidate?.observation.relationship).toBe("unknown");
  });

  it("does not treat pointer-events none as a blocked-by restriction", () => {
    const doc = fixture(`${accountSwitcher()}
      <article data-testid="tweet">
        <div data-testid="User-Name"><span>Normal</span><a href="/Normal">@Normal</a></div>
        <button data-testid="reply"></button>
        <button data-testid="retweet"></button>
        <button data-testid="like"></button>
      </article>
      <div data-testid="cellInnerDiv">
        <article data-testid="tweet">
          <div data-testid="User-Name"><span>Scrolling</span><a href="/Scrolling">@Scrolling</a></div>
          <div style="pointer-events: none">
            <button data-testid="reply"></button>
            <button data-testid="retweet"></button>
            <button data-testid="like"></button>
          </div>
        </article>
      </div>`);
    const candidate = scanXDocument(doc, "https://x.com/Someone/status/123/photo/1", 100)
      .find((item) => item.observation.handle === "Scrolling");

    expect(candidate?.observation.relationship).toBe("unknown");
  });

  it("does not infer blocked-by from an aria-hidden virtualized conversation cell", () => {
    const doc = fixture(`${accountSwitcher()}
      <article data-testid="tweet">
        <div data-testid="User-Name"><span>Normal</span><a href="/Normal">@Normal</a></div>
        <button data-testid="reply"></button>
        <button data-testid="retweet"></button>
        <button data-testid="like"></button>
      </article>
      <div data-testid="cellInnerDiv" aria-hidden="true">
        <article data-testid="tweet">
          <div data-testid="User-Name"><span>HiddenCell</span><a href="/HiddenCell">@HiddenCell</a></div>
          <div aria-disabled="true">
            <button data-testid="reply"></button>
            <button data-testid="retweet"></button>
            <button data-testid="like"></button>
          </div>
        </article>
      </div>`);
    const candidate = scanXDocument(doc, "https://x.com/Someone/status/123/photo/1", 100)
      .find((item) => item.observation.handle === "HiddenCell");

    expect(candidate?.observation.relationship).toBe("unknown");
  });

  it("does not use a background timeline as the interaction baseline for a photo overlay", () => {
    const doc = fixture(`${accountSwitcher()}
      <article data-testid="tweet">
        <div data-testid="User-Name"><span>Timeline</span><a href="/Timeline">@Timeline</a></div>
        <button data-testid="reply"></button>
        <button data-testid="retweet"></button>
        <button data-testid="like"></button>
      </article>
      <div id="layers">
        <div role="dialog" aria-modal="true">
          <div data-testid="cellInnerDiv">
            <article data-testid="tweet">
              <div data-testid="User-Name"><span>Overlay</span><a href="/Overlay">@Overlay</a></div>
              <div aria-disabled="true">
                <button data-testid="reply"></button>
                <button data-testid="retweet"></button>
                <button data-testid="like"></button>
              </div>
            </article>
          </div>
        </div>
      </div>`);
    const candidate = scanXDocument(doc, "https://x.com/Someone/status/123/photo/1", 100)
      .find((item) => item.observation.handle === "Overlay");

    expect(candidate?.observation.relationship).toBe("unknown");
  });

  it("still reads overlay blocked-by when the photo dialog itself has an actionable baseline", () => {
    const doc = fixture(`${accountSwitcher()}
      <div aria-hidden="true">
        <article data-testid="tweet">
          <div data-testid="User-Name"><span>Timeline</span><a href="/Timeline">@Timeline</a></div>
          <button data-testid="reply"></button>
          <button data-testid="retweet"></button>
          <button data-testid="like"></button>
        </article>
      </div>
      <div id="layers">
        <div role="dialog" aria-modal="true">
          <article data-testid="tweet">
            <div data-testid="User-Name"><span>Original</span><a href="/Original">@Original</a></div>
            <button data-testid="reply"></button>
            <button data-testid="retweet"></button>
            <button data-testid="like"></button>
          </article>
          <div data-testid="cellInnerDiv">
            <article data-testid="tweet">
              <div data-testid="User-Name"><span>Blocked</span><a href="/Blocked">@Blocked</a></div>
              <div aria-disabled="true">
                <button data-testid="reply"></button>
                <button data-testid="retweet"></button>
                <button data-testid="like"></button>
              </div>
            </article>
          </div>
        </div>
      </div>`);
    const candidate = scanXDocument(doc, "https://x.com/Someone/status/123/photo/1", 100)
      .find((item) => item.observation.handle === "Blocked");

    expect(candidate?.observation).toMatchObject({
      relationship: "blocked_by",
      evidence: ["blocked-interaction-restriction"],
    });
  });

  it("does not infer blocked-by when only repost is unavailable", () => {
    const doc = fixture(`${accountSwitcher()}
      <article data-testid="tweet">
        <div data-testid="User-Name"><span>Normal</span><a href="/Normal">@Normal</a></div>
        <button data-testid="reply"></button>
        <button data-testid="retweet"></button>
        <button data-testid="like"></button>
      </article>
      <div data-testid="cellInnerDiv">
        <article data-testid="tweet">
          <div data-testid="User-Name"><span>Protected</span><a href="/Protected">@Protected</a></div>
          <button data-testid="reply"></button>
          <button data-testid="retweet" disabled></button>
          <button data-testid="like"></button>
        </article>
      </div>`);
    const candidate = scanXDocument(doc, "https://x.com/Someone/status/123", 100)
      .find((item) => item.observation.handle === "Protected");
    expect(candidate?.observation.relationship).toBe("unknown");
  });

  it("uses an already visible count-less hover card as independent blocked-by evidence", () => {
    const doc = fixture(`<div data-testid="cellInnerDiv"><article data-testid="tweet">
      <div data-testid="User-Name"><span>Blocked</span><a href="/Blocked">@Blocked</a></div>
      <button data-testid="reply"></button>
      <button data-testid="retweet" disabled aria-disabled="true"></button>
      <button data-testid="like"></button>
    </article></div>
    <aside data-testid="HoverCard">
      <a href="/Blocked"><span>Blocked</span><span>@Blocked</span></a>
      <p>Visible biography but no following or follower links.</p>
    </aside>`);
    const candidate = scanXDocument(doc, "https://x.com/Someone/status/123", 100)
      .find((item) => item.observation.handle === "Blocked");
    expect(candidate?.observation).toMatchObject({
      relationship: "blocked_by",
      evidence: ["blocked-profile-summary-restriction"],
    });
  });

  it("keeps a repost-only restriction unknown when a normal hover card has counts", () => {
    const doc = fixture(`<div data-testid="cellInnerDiv"><article data-testid="tweet">
      <div data-testid="User-Name"><span>Protected</span><a href="/Protected">@Protected</a></div>
      <button data-testid="reply"></button>
      <button data-testid="retweet" disabled aria-disabled="true"></button>
      <button data-testid="like"></button>
    </article></div>
    <aside data-testid="HoverCard">
      <a href="/Protected"><span>Protected</span><span>@Protected</span></a>
      <a href="/Protected/following">10 Following</a>
      <a href="/Protected/followers">20 Followers</a>
    </aside>`);
    const candidate = scanXDocument(doc, "https://x.com/Someone/status/123", 100)
      .find((item) => item.observation.handle === "Protected");

    expect(candidate?.observation.relationship).toBe("unknown");
  });

  it("reads a one-way following relationship from the matching visible hover card", () => {
    const doc = fixture(`<article data-testid="tweet">
      <div data-testid="User-Name"><span>One Way</span><a href="/OneWay">@OneWay</a></div>
    </article>
    <aside data-testid="HoverCard">
      <a href="/OneWay"><span>One Way</span><span>@OneWay</span></a>
      <button data-testid="123-unfollow">Following</button>
      <a href="/OneWay/following">10 Following</a>
      <a href="/OneWay/followers">20 Followers</a>
    </aside>`);
    const candidate = scanXDocument(doc, "https://x.com/Someone/status/123", 100)
      .find((item) => item.observation.handle === "OneWay");

    expect(candidate?.observation).toMatchObject({
      relationship: "following_only",
      evidence: ["following-control"],
    });
  });

  it("uses X's locale-independent follow indicator from the matching hover card", () => {
    const doc = fixture(`<article data-testid="tweet">
      <div data-testid="User-Name"><span>Mutual</span><a href="/Mutual">@Mutual</a></div>
    </article>
    <aside data-testid="HoverCard">
      <a href="/Mutual"><span>Mutual</span><span>@Mutual</span></a>
      <button data-testid="456-unfollow">Following</button>
      <span data-testid="userFollowIndicator">Unsupported-locale relationship copy</span>
      <a href="/Mutual/following">10 Following</a>
      <a href="/Mutual/verified_followers">20 Followers</a>
    </aside>`);
    const candidate = scanXDocument(doc, "https://x.com/Someone/status/123", 100)
      .find((item) => item.observation.handle === "Mutual");

    expect(candidate?.observation).toMatchObject({
      relationship: "mutual",
      evidence: ["following-control", "follows-you-label"],
    });
  });

  it("does not apply a visible hover card to another article author", () => {
    const doc = fixture(`<article data-testid="tweet">
      <div data-testid="User-Name"><span>Other</span><a href="/Other">@Other</a></div>
    </article>
    <aside data-testid="HoverCard">
      <a href="/Mutual"><span>Mutual</span><span>@Mutual</span></a>
      <button data-testid="456-unfollow">Following</button>
      <span data-testid="userFollowIndicator">Follows you</span>
      <a href="/Mutual/following">10 Following</a>
      <a href="/Mutual/followers">20 Followers</a>
    </aside>`);
    const candidate = scanXDocument(doc, "https://x.com/Someone/status/123", 100)
      .find((item) => item.observation.handle === "Other");

    expect(candidate?.observation.relationship).toBe("unknown");
  });

  it("does not use relationship controls from a hover card that is still loading", () => {
    const doc = fixture(`<article data-testid="tweet">
      <div data-testid="User-Name"><span>Loading</span><a href="/Loading">@Loading</a></div>
    </article>
    <aside data-testid="HoverCard">
      <a href="/Loading"><span>Loading</span><span>@Loading</span></a>
      <div role="progressbar"></div>
      <button data-testid="789-unfollow">Following</button>
    </aside>`);
    const candidate = scanXDocument(doc, "https://x.com/Someone/status/123", 100)
      .find((item) => item.observation.handle === "Loading");

    expect(candidate?.observation.relationship).toBe("unknown");
  });

  it("does not use a hidden stale hover card for relationship evidence", () => {
    const doc = fixture(`${accountSwitcher()}<article>
      <div data-testid="User-Name"><span>Hidden</span><a href="/Hidden">@Hidden</a></div>
    </article>
    <div aria-hidden="true">
      <div data-testid="HoverCard">
        <a href="/Hidden">@Hidden</a>
        <button data-testid="789-unfollow">Following</button>
      </div>
    </div>`);

    const [candidate] = scanXDocument(doc, "https://x.com/Someone/status/123", 100);
    expect(candidate?.observation.relationship).toBe("unknown");
  });

  it("does not treat a generic unavailable reply as blocked-by evidence", () => {
    const doc = fixture(`<article data-testid="tweet">
      <div data-testid="User-Name"><span>Missing Post</span><a href="/MissingPost">@MissingPost</a></div>
      <div>This Post is unavailable.</div>
    </article>`);
    const [candidate] = scanXDocument(doc, "https://x.com/Someone/status/123", 100);
    expect(candidate?.observation.relationship).toBe("unknown");
  });

  it("does not treat user-authored post text as a platform blocked notice", () => {
    const doc = fixture(`<article data-testid="tweet">
      <div data-testid="User-Name"><span>Writer</span><a href="/Writer">@Writer</a></div>
      <div data-testid="tweetText">That account has blocked you, apparently.</div>
    </article>`);
    const [candidate] = scanXDocument(doc, "https://x.com/Someone/status/123", 100);
    expect(candidate?.observation.relationship).toBe("unknown");
  });

  it("excludes the signed-in viewer from observations", () => {
    const doc = fixture(`${accountSwitcher("Viewer")}<article data-testid="tweet">
      <div data-testid="User-Name"><span>Me</span><a href="/Viewer">@Viewer</a></div>
    </article>`);
    expect(scanXDocument(doc, "https://x.com/home", 100)).toEqual([]);
  });

  it("does not mistake a display name for the handle", () => {
    const doc = fixture(`<article><div data-testid="UserName"><span>Alice</span><a href="/Real_Handle">@Real_Handle</a></div></article>`);
    const [candidate] = scanXDocument(doc, "https://x.com/home", 100);
    expect(candidate?.observation.handle).toBe("Real_Handle");
  });

  it("identifies a home timeline author from a status permalink when the handle is hidden", () => {
    const doc = fixture(`${accountSwitcher()}<article data-testid="tweet">
      <div data-testid="Tweet-User-Avatar"><a href="/Alice"><img src="https://pbs.twimg.com/profile_images/1.jpg" alt=""></a></div>
      <div data-testid="User-Name">
        <a href="/Alice/status/1234567890123456789"><span>Alice Example</span></a>
        <a href="/Alice/status/1234567890123456789"><time datetime="2026-08-18T00:00:00.000Z">2h</time></a>
      </div>
    </article>`);
    const [candidate] = scanXDocument(doc, "https://x.com/home", 100);
    expect(candidate?.observation).toMatchObject({
      handle: "Alice",
      relationship: "unknown",
      sourceType: "timeline",
      evidence: ["insufficient-evidence"],
    });
  });

  it("reads a bidi-wrapped handle next to a home timeline display name", () => {
    const doc = fixture(`${accountSwitcher()}<article data-testid="tweet">
      <div data-testid="User-Name">
        <a href="/Alice/status/123"><span>Alice Example</span></a>
        <span>\u2066@Alice\u2069</span>
      </div>
    </article>`);
    const [candidate] = scanXDocument(doc, "https://x.com/home", 100);
    expect(candidate?.observation.handle).toBe("Alice");
  });

  it("identifies a compact timeline card from the author avatar when User-Name is absent", () => {
    const doc = fixture(`${accountSwitcher()}<article data-testid="tweet">
      <div data-testid="Tweet-User-Avatar"><a href="/Alice"><img src="https://pbs.twimg.com/profile_images/1.jpg" alt=""></a></div>
      <a href="/Alice/status/123"><span>Alice Example</span></a>
    </article>`);
    const [candidate] = scanXDocument(doc, "https://x.com/home", 100);
    expect(candidate?.observation.handle).toBe("Alice");
    expect(candidate?.observation.relationship).toBe("unknown");
  });

  it("applies a matching home-timeline hover card to the status-link author card", () => {
    const doc = fixture(`${accountSwitcher()}<article data-testid="tweet">
      <div data-testid="User-Name">
        <a href="/Alice/status/123"><span>Alice Example</span></a>
      </div>
    </article>
    <aside data-testid="HoverCard">
      <a href="/Alice"><span>Alice Example</span><span>@Alice</span></a>
      <button data-testid="123-unfollow">Following</button>
      <a href="/Alice/following">10 Following</a>
      <a href="/Alice/followers">20 Followers</a>
    </aside>`);
    const candidate = scanXDocument(doc, "https://x.com/home", 100)
      .find((item) => item.observation.handle === "Alice");
    expect(candidate?.observation).toMatchObject({
      relationship: "following_only",
      evidence: ["following-control"],
    });
  });

  it("collects a visible hover card even when the tweet has no identity testid", () => {
    const doc = fixture(`${accountSwitcher()}<article data-testid="tweet">
      <span>Suggested post</span>
    </article>
    <aside data-testid="HoverCard">
      <a href="/Alice"><span>@Alice</span></a>
      <button data-testid="123-unfollow">Following</button>
      <span data-testid="userFollowIndicator">Follows you</span>
      <a href="/Alice/following">10 Following</a>
      <a href="/Alice/followers">20 Followers</a>
    </aside>`);
    const candidate = scanXDocument(doc, "https://x.com/home", 100)
      .find((item) => item.observation.handle === "Alice");
    expect(candidate?.observation).toMatchObject({
      relationship: "mutual",
      evidence: ["following-control", "follows-you-label"],
    });
  });

  it("does not use the handle/time separator as a display name", () => {
    const doc = fixture(`${accountSwitcher()}<div data-testid="UserCell">
      <div data-testid="UserAvatar-Container-OpenAI">
        <a href="/OpenAI"><img src="https://pbs.twimg.com/profile_images/1/openai_normal.jpg" alt=""></a>
      </div>
      <div data-testid="UserName">
        <a href="/OpenAI">OpenAI</a>
        <span>@OpenAI</span>
        <span>·</span>
      </div>
    </div>`);
    const [candidate] = scanXDocument(doc, "https://x.com/Viewer/following", 100);
    expect(candidate?.observation).toMatchObject({
      handle: "OpenAI",
      displayName: "OpenAI",
      avatarUrl: "https://pbs.twimg.com/profile_images/1/openai_x96.jpg",
    });
  });

  it("pairs the avatar to the matching handle instead of a quoted author", () => {
    const doc = fixture(`${accountSwitcher()}<article data-testid="tweet">
      <div data-testid="Tweet-User-Avatar">
        <a href="/Alice"><img src="https://pbs.twimg.com/profile_images/1/alice_normal.jpg" alt=""></a>
      </div>
      <div data-testid="User-Name">
        <a href="/Alice/status/1"><span>Alice Example</span></a>
        <span>@Alice</span>
      </div>
      <article data-testid="tweet">
        <div data-testid="Tweet-User-Avatar">
          <a href="/Quoted"><img src="https://pbs.twimg.com/profile_images/2/quoted_normal.jpg" alt=""></a>
        </div>
        <div data-testid="User-Name"><span>Quoted Person</span><span>@Quoted</span></div>
      </article>
    </article>`);
    const alice = scanXDocument(doc, "https://x.com/home", 100)
      .find((item) => item.observation.handle === "Alice");
    expect(alice?.observation).toMatchObject({
      displayName: "Alice Example",
      avatarUrl: "https://pbs.twimg.com/profile_images/1/alice_x96.jpg",
    });
  });

  it("does not take a quoted author's missing handle from the outer tweet avatar", () => {
    const doc = fixture(`${accountSwitcher()}<article data-testid="tweet">
      <div data-testid="Tweet-User-Avatar"><a href="/Alice"><img src="https://pbs.twimg.com/profile_images/1.jpg" alt=""></a></div>
      <div data-testid="User-Name"><a href="/Alice/status/1"><span>Alice Example</span></a></div>
      <article data-testid="tweet">
        <div data-testid="User-Name"><span>Quoted Person</span></div>
      </article>
    </article>`);
    const candidates = scanXDocument(doc, "https://x.com/home", 100);
    expect(candidates.map((item) => item.observation.handle)).toEqual(["Alice"]);
  });
});

import { describe, expect, it } from "vitest";
import { scanXDocument, sourceTypeFromUrl } from "./x-adapter";

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
          <div data-testid="like"><span aria-hidden="true"></span></div>
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
});

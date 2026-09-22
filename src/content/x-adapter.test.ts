import { describe, expect, it } from "vitest";
import {
  handleFromHoverCard,
  hoverCardActionContainer,
  isInsideXUserAuthoredContent,
  mediaLightboxTweetFrom,
  openTweetMoreMenu,
  scanXDocument,
  sourceTypeFromUrl,
  tweetAuthorHandle,
  tweetTextRootFrom,
  viewerHandleFromDocument,
  visibleHoverCards,
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

describe("mediaLightboxTweetFrom", () => {
  it("identifies tweets inside a photo lightbox conversation", () => {
    const doc = fixture(`
      <div role="dialog" aria-modal="true">
        <div data-testid="swipe-to-dismiss"></div>
        <article data-testid="tweet">
          <div data-testid="User-Name"><a href="/Alice">@Alice</a></div>
        </article>
      </div>
      <article data-testid="tweet">
        <div data-testid="User-Name"><a href="/Timeline">@Timeline</a></div>
      </article>`);
    const overlay = doc.querySelector<HTMLElement>("[role='dialog'] [data-testid='User-Name']")!;
    const timeline = doc.querySelectorAll<HTMLElement>("[data-testid='User-Name']")[1]!;
    expect(mediaLightboxTweetFrom(overlay)?.getAttribute("data-testid")).toBe("tweet");
    expect(mediaLightboxTweetFrom(timeline)).toBeNull();
  });

  it("treats dialog tweets as lightbox conversation on a photo URL", () => {
    const doc = fixture(`
      <div role="dialog" aria-modal="true">
        <article data-testid="tweet">
          <div data-testid="User-Name"><a href="/Alice">@Alice</a></div>
        </article>
      </div>`);
    const named = doc.querySelector<HTMLElement>("[data-testid='User-Name']")!;
    expect(mediaLightboxTweetFrom(named, "https://x.com/Someone/status/123/photo/1")).not.toBeNull();
    expect(mediaLightboxTweetFrom(named, "https://x.com/home")).toBeNull();
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

  it("reads explicit neither-following on the viewer's following list", () => {
    const doc = fixture(`${accountSwitcher()}<div data-testid="primaryColumn">
      <div data-testid="UserCell">
        <div data-testid="UserName"><span>Alice Example</span><span>@Alice</span></div>
        <button data-testid="123-follow">Follow</button>
      </div>
    </div>`);
    const [candidate] = scanXDocument(doc, "https://x.com/Viewer/following", 100);
    expect(candidate?.observation.relationship).toBe("none");
  });

  it("does not treat a Follow button on a search UserCell as neither-following", () => {
    const doc = fixture(`${accountSwitcher()}<div data-testid="UserCell">
      <div data-testid="UserName"><span>Alice Example</span><span>@Alice</span></div>
      <button data-testid="123-follow">Follow</button>
    </div>`);
    const [candidate] = scanXDocument(doc, "https://x.com/search?q=alice", 100);
    expect(candidate?.observation.relationship).toBe("unknown");
    expect(candidate?.observation.evidence).toEqual(["follow-control"]);
  });

  it("does not treat a Who to follow suggestion as unfollowed", () => {
    const doc = fixture(`${accountSwitcher()}
      <div data-testid="primaryColumn">
        <div data-testid="cellInnerDiv">
          <h2>跟隨誰</h2>
          <div data-testid="UserCell">
            <div data-testid="UserName"><span>Alice Example</span><span>@Alice</span></div>
            <button data-testid="123-follow">跟隨</button>
          </div>
          <a href="/i/connect_people">顯示更多</a>
        </div>
      </div>`);
    const [candidate] = scanXDocument(doc, "https://x.com/home", 100);
    expect(candidate?.observation).toMatchObject({
      handle: "Alice",
      relationship: "unknown",
      evidence: ["follow-control"],
    });
    expect(candidate?.acceptPageStoreRelationship).toBe(false);
  });

  it("still collects Follows you from a Who to follow card", () => {
    const doc = fixture(`${accountSwitcher()}
      <aside aria-label="Who to follow">
        <h2>Who to follow</h2>
        <div data-testid="UserCell">
          <div data-testid="UserName"><span>Alice Example</span><span>@Alice</span></div>
          <span>Follows you</span>
          <button data-testid="123-follow">Follow</button>
        </div>
      </aside>`);
    const [candidate] = scanXDocument(doc, "https://x.com/home", 100);
    expect(candidate?.observation.relationship).toBe("follows_you_only");
    expect(candidate?.acceptPageStoreRelationship).toBe(false);
  });

  it("does not use a following-page sidebar suggestion as neither-following", () => {
    const doc = fixture(`${accountSwitcher()}
      <div data-testid="primaryColumn">
        <div data-testid="UserCell">
          <div data-testid="UserName"><span>Mutual Pal</span><span>@MutualPal</span></div>
          <span>Follows you</span>
          <button data-testid="1-unfollow">Following</button>
        </div>
      </div>
      <aside>
        <h2>Who to follow</h2>
        <div data-testid="UserCell">
          <div data-testid="UserName"><span>Suggested</span><span>@Suggested</span></div>
          <button data-testid="2-follow">Follow</button>
        </div>
      </aside>`);
    const candidates = scanXDocument(doc, "https://x.com/Viewer/following", 100);
    expect(candidates.find((item) => item.observation.handle === "MutualPal")?.observation.relationship)
      .toBe("mutual");
    const suggested = candidates.find((item) => item.observation.handle === "Suggested");
    expect(suggested?.observation.relationship).toBe("unknown");
    expect(suggested?.acceptPageStoreRelationship).toBe(false);
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

  it("lets an explicit Simplified Chinese blocked notice override follows-you", () => {
    const doc = fixture(`<main data-testid="primaryColumn">
      <div data-testid="UserName">
        <span>271828</span>
        <span data-testid="userFollowIndicator">关注了你</span>
        <span>@RUIXUANLIU2190</span>
      </div>
      <section>
        <h2>@RUIXUANLIU2190 已屏蔽你</h2>
        <p>你可以查看公开帖子，但无法与它们互动。</p>
      </section>
    </main>`);

    const candidate = scanXDocument(doc, "https://x.com/RUIXUANLIU2190", 100)[0];
    expect(candidate?.observation).toMatchObject({
      handle: "RUIXUANLIU2190",
      relationship: "blocked_by",
    });
    expect(candidate?.observation.evidence).toEqual([
      "blocked-notice",
      "follows-you-label",
    ]);
  });

  it.each([
    ["en", "@TargetUser has blocked you", "You can view public posts, but you cannot interact with them."],
    ["ja", "@TargetUserさんにブロックされています", "公開ポストは表示できますが、反応することはできません。"],
    ["zh-CN", "@TargetUser 已屏蔽你", "你可以查看公开帖子，但无法与它们互动。"],
    ["zh-TW", "@TargetUser 已封鎖你", "你可以查看公開貼文，但無法與其互動。"],
  ])("recognizes a post-less blocked profile in %s", (_locale, heading, detail) => {
    const doc = fixture(`<main data-testid="primaryColumn">
      <div data-testid="UserName"><span>Target</span><span>@TargetUser</span></div>
      <section><h2>${heading}</h2><p>${detail}</p></section>
    </main>`);

    const candidates = scanXDocument(doc, "https://x.com/TargetUser", 100);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.observation).toMatchObject({
      handle: "TargetUser",
      relationship: "blocked_by",
      evidence: ["blocked-notice"],
    });
  });

  it("does not treat profile identity text or an existing extension badge as platform evidence", () => {
    const doc = fixture(`<main data-testid="primaryColumn">
      <div data-testid="UserName">
        <span>已屏蔽你</span><span>@OrdinaryUser</span>
        <span data-xro-badge="follows_you_only">关注了你</span>
      </div>
      <div data-testid="UserDescription">个人简介里写着“已屏蔽你”</div>
    </main>`);

    const candidate = scanXDocument(doc, "https://x.com/OrdinaryUser", 100)[0];
    expect(candidate?.observation.relationship).toBe("unknown");
    expect(candidate?.observation.evidence).toEqual(["insufficient-evidence"]);
  });

  it("does not leak nested profile-feed evidence into the viewed account", () => {
    const doc = fixture(`<main data-testid="primaryColumn">
      <div data-testid="UserName"><span>Target</span><span>@TargetUser</span></div>
      <div data-testid="cellInnerDiv">
        <article data-testid="tweet">
          <div data-testid="User-Name"><span>Other</span><span>@OtherUser</span></div>
        </article>
        <div>This post is from an account that has blocked you.</div>
      </div>
      <div data-testid="UserCell">
        <div data-testid="UserName"><span>Suggested</span><span>@SuggestedUser</span></div>
        <span data-testid="userFollowIndicator">Follows you</span>
      </div>
    </main>`);

    const target = scanXDocument(doc, "https://x.com/TargetUser", 100)
      .find((candidate) => candidate.observation.handle === "TargetUser");
    expect(target?.observation.relationship).toBe("unknown");
    expect(target?.observation.evidence).toEqual(["insufficient-evidence"]);
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

  it("uses the declared avatar src instead of a stale currentSrc from a recycled row", () => {
    const doc = fixture(`${accountSwitcher()}<div data-testid="UserCell">
      <div data-testid="UserAvatar-Container-Alice">
        <a href="/Alice"><img src="https://pbs.twimg.com/profile_images/1/alice_normal.jpg" alt=""></a>
      </div>
      <div data-testid="UserName"><a href="/Alice">Alice</a><span>@Alice</span></div>
    </div>`);
    const image = doc.querySelector("img")!;
    Object.defineProperty(image, "currentSrc", {
      configurable: true,
      value: "https://pbs.twimg.com/profile_images/2/previous-user_normal.jpg",
    });

    const [candidate] = scanXDocument(doc, "https://x.com/Viewer/following", 100);
    expect(candidate?.observation.avatarUrl).toBe(
      "https://pbs.twimg.com/profile_images/1/alice_x96.jpg",
    );
  });

  it("ignores an unmatched first avatar and uses the image linked to the same handle", () => {
    const doc = fixture(`${accountSwitcher()}<div data-testid="UserCell">
      <div data-testid="Tweet-User-Avatar">
        <a href="/Bob"><img src="https://pbs.twimg.com/profile_images/2/bob_normal.jpg" alt=""></a>
      </div>
      <div data-testid="UserAvatar-Container-Alice">
        <a href="/Alice"><img src="https://pbs.twimg.com/profile_images/1/alice_normal.jpg" alt=""></a>
      </div>
      <div data-testid="UserName"><a href="/Alice">Alice</a><span>@Alice</span></div>
    </div>`);

    const alice = scanXDocument(doc, "https://x.com/Viewer/following", 100)
      .find((item) => item.observation.handle === "Alice");
    expect(alice?.observation.avatarUrl).toBe(
      "https://pbs.twimg.com/profile_images/1/alice_x96.jpg",
    );
  });

  it("keeps the avatar empty when no image can be bound to the candidate handle", () => {
    const doc = fixture(`${accountSwitcher()}<div data-testid="UserCell">
      <div data-testid="Tweet-User-Avatar">
        <a href="/Bob"><img src="https://pbs.twimg.com/profile_images/2/bob_normal.jpg" alt=""></a>
      </div>
      <div data-testid="UserName"><a href="/Alice">Alice</a><span>@Alice</span></div>
    </div>`);

    const alice = scanXDocument(doc, "https://x.com/Viewer/following", 100)
      .find((item) => item.observation.handle === "Alice");
    expect(alice?.observation.avatarUrl).toBeNull();
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

  it("does not treat tweet-body @mentions as authors", () => {
    const mentions = Array.from({ length: 80 }, (_, index) =>
      `<a href="/user${index}"><span>@user${index}</span></a>`,
    ).join("");
    const doc = fixture(`${accountSwitcher()}<article data-testid="tweet">
      <div data-testid="tweetText">${mentions}</div>
    </article>`);

    expect(
      scanXDocument(doc, "https://x.com/unki0422/status/2092619334267076924", 100)
        .map((item) => item.observation.handle),
    ).toEqual([]);
  });

  it("keeps mention-heavy thread authors and skips in-post @handles", () => {
    const mentions = Array.from({ length: 240 }, (_, index) =>
      `<a href="/ping${index}"><span>@ping${index}</span></a>`,
    ).join("");
    const doc = fixture(`${accountSwitcher()}
      <div data-testid="cellInnerDiv">
        <article data-testid="tweet">
          <div data-testid="Tweet-User-Avatar">
            <a href="/unki0422"><img src="https://pbs.twimg.com/profile_images/1/unki_normal.jpg" alt=""></a>
          </div>
          <div data-testid="User-Name"><span>Unki</span><a href="/unki0422">@unki0422</a></div>
          <div data-testid="tweetText">${mentions}</div>
          <div>This post is from an account that blocked you.</div>
        </article>
      </div>
      <div data-testid="cellInnerDiv">
        <article data-testid="tweet">
          <div data-testid="Tweet-User-Avatar">
            <a href="/ReplyUser"><img src="https://pbs.twimg.com/profile_images/2/reply_normal.jpg" alt=""></a>
          </div>
          <div data-testid="User-Name"><span>Reply User</span><a href="/ReplyUser">@ReplyUser</a></div>
          <div data-testid="tweetText">${mentions}</div>
        </article>
      </div>`);
    const started = Date.now();
    let candidates = scanXDocument(
      doc,
      "https://x.com/unki0422/status/2092619334267076924",
      100,
    );
    for (let pass = 0; pass < 4; pass += 1) {
      candidates = scanXDocument(
        doc,
        "https://x.com/unki0422/status/2092619334267076924",
        100,
      );
    }

    expect(candidates.map((item) => item.observation.handle)).toEqual([
      "unki0422",
      "ReplyUser",
    ]);
    expect(candidates[0]?.observation).toMatchObject({
      handle: "unki0422",
      relationship: "blocked_by",
      evidence: ["blocked-notice"],
    });
    expect(candidates[1]?.observation.relationship).toBe("unknown");
    // Five passes stay well under a freeze; coverage instrumentation is slower than `npm test`.
    expect(Date.now() - started).toBeLessThan(1500);
  });

  it("still identifies a compact card when tweetText is packed with mentions", () => {
    const mentions = Array.from({ length: 120 }, (_, index) =>
      `<a href="/ping${index}">@ping${index}</a>`,
    ).join("");
    const doc = fixture(`${accountSwitcher()}<article data-testid="tweet">
      <div data-testid="Tweet-User-Avatar">
        <a href="/Alice"><img src="https://pbs.twimg.com/profile_images/1.jpg" alt=""></a>
      </div>
      <a href="/Alice/status/123"><span>Alice Example</span></a>
      <div data-testid="tweetText">${mentions}</div>
    </article>`);

    const [candidate] = scanXDocument(doc, "https://x.com/home", 100);
    expect(candidate?.observation.handle).toBe("Alice");
  });

  it("identifies notification actors and ignores the historical action sentence", () => {
    const doc = fixture(`${accountSwitcher()}
      <div data-testid="cellInnerDiv">
        <article data-testid="notification">
          <a href="/Alice/status/123">
            <a href="/Alice">
              <div data-testid="UserAvatar-Container-Alice">
                <img src="https://pbs.twimg.com/profile_images/1/alice_normal.jpg" alt="">
              </div>
            </a>
            <div>
              <a href="/Alice"><span>Alice Example</span></a>
              <span>关注了你</span>
            </div>
          </a>
          <button data-testid="99-follow">关注</button>
        </article>
      </div>`);

    const [candidate] = scanXDocument(doc, "https://x.com/notifications", 100);
    expect(candidate?.observation).toMatchObject({
      handle: "Alice",
      displayName: "Alice Example",
      sourceType: "notifications",
      relationship: "unknown",
      avatarUrl: "https://pbs.twimg.com/profile_images/1/alice_x96.jpg",
    });
    expect(candidate?.anchor.getAttribute("href")).toBe("/Alice");
    expect(candidate?.anchor.textContent).toBe("Alice Example");
    expect(candidate?.observation.evidence).not.toContain("follows-you-label");

    const badge = doc.createElement("span");
    badge.setAttribute("data-xro-badge", "mutual");
    badge.textContent = "互关";
    candidate?.anchor.append(badge);
    const again = scanXDocument(doc, "https://x.com/notifications", 100);
    expect(again).toHaveLength(1);
    expect(again[0]?.observation.displayName).toBe("Alice Example");
    expect(again[0]?.anchor.querySelectorAll("[data-xro-badge]")).toHaveLength(1);
  });

  it("reads live follow controls on a single notification row", () => {
    const doc = fixture(`${accountSwitcher()}
      <article data-testid="notification">
        <a href="/Bob">
          <div data-testid="UserAvatar-Container-Bob">
            <img src="https://pbs.twimg.com/profile_images/2/bob_normal.jpg" alt="">
          </div>
        </a>
        <a href="/Bob"><span>Bob</span></a>
        <button data-testid="7-unfollow">Following</button>
        <div data-testid="userFollowIndicator">Follows you</div>
      </article>`);

    const [candidate] = scanXDocument(doc, "https://x.com/notifications/mentions", 100);
    expect(candidate?.observation).toMatchObject({
      handle: "Bob",
      sourceType: "notifications",
      relationship: "mutual",
      evidence: ["following-control", "follows-you-label"],
    });
  });

  it("keeps each notification actor separate and skips preview links without avatars", () => {
    const doc = fixture(`${accountSwitcher()}
      <article data-testid="notification">
        <a href="/Alice">
          <div data-testid="UserAvatar-Container-Alice">
            <img src="https://pbs.twimg.com/profile_images/1/alice_normal.jpg" alt="">
          </div>
        </a>
        <a href="/Bob">
          <div data-testid="UserAvatar-Container-Bob">
            <img src="https://pbs.twimg.com/profile_images/2/bob_normal.jpg" alt="">
          </div>
        </a>
        <div>
          <a href="/Alice"><span>Alice</span></a>
          <span> and </span>
          <a href="/Bob"><span>Bob</span></a>
          <span> liked a post mentioning </span>
          <a href="/Carol">Carol</a>
        </div>
        <button data-testid="1-follow">Follow</button>
        <div data-testid="userFollowIndicator">Follows you</div>
        <article data-testid="tweet">
          <div data-testid="User-Name"><a href="/Viewer">@Viewer</a></div>
        </article>
      </article>`);

    const candidates = scanXDocument(doc, "https://x.com/notifications", 100);
    expect(candidates.map((item) => item.observation.handle)).toEqual(["Alice", "Bob"]);
    expect(candidates.map((item) => item.observation.relationship)).toEqual(["unknown", "unknown"]);
    expect(new Set(candidates.map((item) => item.anchor)).size).toBe(2);
    expect(candidates.every((item) => item.anchor.textContent === item.observation.handle)).toBe(true);
  });

  it("badges an avatar-only notification actor from the avatar link", () => {
    const doc = fixture(`${accountSwitcher()}
      <article data-testid="notification">
        <a href="/Dana">
          <div data-testid="UserAvatar-Container-Dana">
            <img src="https://pbs.twimg.com/profile_images/4/dana_normal.jpg" alt="">
          </div>
        </a>
        <span>and 2 others liked your post</span>
      </article>`);

    const [candidate] = scanXDocument(doc, "https://x.com/notifications", 100);
    expect(candidate?.observation.handle).toBe("Dana");
    expect(candidate?.anchor.getAttribute("href")).toBe("/Dana");
    expect(candidate?.anchor.querySelector("img")).not.toBeNull();
  });
});

describe("hover card and tweet text helpers", () => {
  it("reads a loaded hover card handle and ignores tweet-body mentions", () => {
    const doc = fixture(`<article data-testid="tweet">
      <div data-testid="tweetText"><a href="/Mention">@Mention</a></div>
    </article>
    <aside data-testid="HoverCard">
      <a href="/Alice"><span>@Alice</span></a>
    </aside>`);
    const card = doc.querySelector('[data-testid="HoverCard"]')!;
    expect(handleFromHoverCard(card)).toBe("Alice");
    expect([...visibleHoverCards(doc).keys()]).toEqual(["alice"]);
    expect(tweetTextRootFrom(doc.querySelector('a[href="/Mention"]')!)).not.toBeNull();
    expect(tweetTextRootFrom(card)).toBeNull();
  });

  it("descends single-child wrappers to the HoverCard's content container", () => {
    const doc = fixture(`<aside data-testid="HoverCard">
      <div id="w1"><div id="w2">
        <div data-testid="User-Name"><a href="/Alice">Alice</a></div>
        <p>bio</p>
      </div></div>
    </aside>`);
    const card = doc.querySelector<HTMLElement>('[data-testid="HoverCard"]')!;
    expect(hoverCardActionContainer(card).id).toBe("w2");
  });

  it("stops at the card root when it already branches, and never enters injected rows", () => {
    const doc = fixture(`<aside data-testid="HoverCard">
      <div data-testid="User-Name"><a href="/Alice">Alice</a></div>
      <p>bio</p>
    </aside>`);
    const card = doc.querySelector<HTMLElement>('[data-testid="HoverCard"]')!;
    expect(hoverCardActionContainer(card)).toBe(card);

    const onlyChild = fixture(`<aside data-testid="HoverCard">
      <div data-xro-quick-rule="handle-row"><button></button></div>
    </aside>`);
    const lone = onlyChild.querySelector<HTMLElement>('[data-testid="HoverCard"]')!;
    expect(hoverCardActionContainer(lone)).toBe(lone);
  });

  it("reads the expanded tweet more-menu author and ignores quoted inner carets", () => {
    const doc = fixture(`<article data-testid="tweet">
      <div data-testid="Tweet-User-Avatar"><a href="/Alice"><img alt=""></a></div>
      <button data-testid="caret" aria-expanded="true">More</button>
      <article data-testid="tweet">
        <div data-testid="Tweet-User-Avatar"><a href="/Quoted"><img alt=""></a></div>
        <button data-testid="caret" aria-expanded="false">More</button>
      </article>
    </article>
    <div data-testid="Dropdown"><div role="menu"><div role="menuitem">Mute</div></div></div>`);
    const outer = doc.querySelector("article")!;
    expect(tweetAuthorHandle(outer)).toBe("Alice");
    const open = openTweetMoreMenu(doc);
    expect(open?.handle).toBe("Alice");
    expect(open?.menu.getAttribute("role")).toBe("menu");
  });
});

describe("isInsideXUserAuthoredContent", () => {
  it("marks tweet-body mentions and not the author identity", () => {
    const doc = fixture(`<article data-testid="tweet">
      <div data-testid="User-Name"><a href="/Author">@Author</a></div>
      <div data-testid="tweetText"><a href="/Mention">@Mention</a></div>
    </article>`);
    expect(isInsideXUserAuthoredContent(doc.querySelector('a[href="/Mention"]')!)).toBe(true);
    expect(isInsideXUserAuthoredContent(doc.querySelector('a[href="/Author"]')!)).toBe(false);
  });
});

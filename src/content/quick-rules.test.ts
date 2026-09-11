import { afterEach, describe, expect, it, vi } from "vitest";
import {
  refreshHoverQuickRules,
  refreshKeywordQuickRule,
  refreshTweetMenuQuickRules,
  removeQuickRuleActions,
} from "./quick-rules";

function fixture(body: string): Document {
  return new DOMParser().parseFromString(`<html><body>${body}</body></html>`, "text/html");
}

afterEach(() => {
  document.body.innerHTML = "";
  window.getSelection()?.removeAllRanges();
});

describe("quick rule actions", () => {
  it("adds a Not Brother action to a loaded hover card and reports the handle", () => {
    const doc = fixture(`<aside data-testid="HoverCard">
      <a href="/Alice"><span>@Alice</span></a>
      <button data-testid="123-unfollow">Following</button>
    </aside>`);
    const onAddHandle = vi.fn();
    refreshHoverQuickRules(doc, {
      locale: "zh-CN",
      viewerHandle: "Viewer",
      enabled: true,
      blockedHandles: new Set(),
      onAddHandle,
      onAddKeyword: vi.fn(),
    });
    const button = doc.querySelector<HTMLButtonElement>("[data-xro-quick-rule='handle']");
    expect(button?.textContent).toContain("不是兄弟");
    button?.click();
    expect(onAddHandle).toHaveBeenCalledWith("Alice");
  });

  it("places a distinct action row at the HoverCard footer with a native title hint", () => {
    const doc = fixture(`<aside data-testid="HoverCard">
      <div data-testid="User-Name"><a href="/Alice"><span>Alice</span></a><span>@Alice</span></div>
      <p>A long bio that used to sit between the name and the action.</p>
      <a href="/Alice/following">1 Following</a>
      <a href="/Alice/verified_followers">2 Followers</a>
    </aside>`);
    refreshHoverQuickRules(doc, {
      locale: "zh-CN",
      viewerHandle: "Viewer",
      enabled: true,
      blockedHandles: new Set(),
      onAddHandle: vi.fn(),
      onAddKeyword: vi.fn(),
    });
    const name = doc.querySelector("[data-testid='User-Name']");
    const card = doc.querySelector("[data-testid='HoverCard']");
    const row = doc.querySelector("[data-xro-quick-rule='handle-row']");
    const button = doc.querySelector<HTMLButtonElement>("[data-xro-quick-rule='handle']");
    expect(card?.lastElementChild).toBe(row);
    expect(name?.nextElementSibling?.textContent).toContain("long bio");
    expect(row?.contains(button ?? null)).toBe(true);
    expect(button?.textContent).toContain("加入“不是兄弟”名单");
    expect(button?.getAttribute("aria-label")).toBe("把 @Alice 加入“不是兄弟”名单");
    expect(button?.querySelector(".xro-quick-rule__mark")?.getAttribute("aria-hidden")).toBe("true");
    // The hint rides on the native title so it cannot close the HoverCard.
    expect(button?.title).toContain("本地拦截规则");
    expect(button?.title).toContain("不会在 X 上拉黑");
    expect(row?.querySelector("[role='tooltip']")).toBeNull();
  });

  it("appends the row inside X's content wrapper, not as a sibling of it", () => {
    // A row appended to the HoverCard root sits outside the wrapper X tracks for
    // hover, so pointing at it closes the card.
    const doc = fixture(`<aside data-testid="HoverCard">
      <div class="wrapper"><div class="content">
        <div data-testid="User-Name"><a href="/Alice"><span>@Alice</span></a></div>
        <p>bio</p>
      </div></div>
    </aside>`);
    refreshHoverQuickRules(doc, {
      locale: "en",
      viewerHandle: "Viewer",
      enabled: true,
      blockedHandles: new Set(),
      onAddHandle: vi.fn(),
      onAddKeyword: vi.fn(),
    });
    const content = doc.querySelector(".content");
    const row = doc.querySelector<HTMLElement>("[data-xro-quick-rule='handle-row']");
    expect(row?.parentElement).toBe(content);
    expect(content?.lastElementChild).toBe(row);
    expect(row?.dataset.xroRowInset).toBe("content");

    // Re-running must not descend into or re-parent the row it already placed.
    refreshHoverQuickRules(doc, {
      locale: "en",
      viewerHandle: "Viewer",
      enabled: true,
      blockedHandles: new Set(),
      onAddHandle: vi.fn(),
      onAddKeyword: vi.fn(),
    });
    expect(doc.querySelectorAll("[data-xro-quick-rule='handle-row']")).toHaveLength(1);
    expect(doc.querySelector("[data-xro-quick-rule='handle-row']")?.parentElement).toBe(content);
  });

  it("does not mark the signed-in viewer and paints an already-listed account", () => {
    const doc = fixture(`
      <aside data-testid="HoverCard"><a href="/Viewer"><span>@Viewer</span></a></aside>
      <aside data-testid="HoverCard"><a href="/Blocked"><span>@Blocked</span></a></aside>
    `);
    refreshHoverQuickRules(doc, {
      locale: "en",
      viewerHandle: "viewer",
      enabled: true,
      blockedHandles: new Set(["blocked"]),
      onAddHandle: vi.fn(),
      onAddKeyword: vi.fn(),
    });
    const buttons = [...doc.querySelectorAll("[data-xro-quick-rule='handle']")];
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.textContent).toContain("Already in Not Brother list");
    expect(buttons[0]?.getAttribute("aria-disabled")).toBe("true");
    expect(buttons[0]?.getAttribute("aria-label"))
      .toBe("@Blocked is already in the Not Brother list");
    expect(buttons[0]?.getAttribute("title"))
      .toContain("already in the local filter rules");
  });

  it("shows a keyword chip for tweet-text selections and not for author chrome", () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="User-Name"><a href="/Alice">@Alice</a></div>
        <div data-testid="tweetText">Limited GIVEAWAY today</div>
      </article>
    `;
    const text = document.querySelector("[data-testid='tweetText']")!;
    const range = document.createRange();
    range.selectNodeContents(text);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    const onAddKeyword = vi.fn();
    refreshKeywordQuickRule(document, {
      locale: "zh-CN",
      enabled: true,
      onAddKeyword,
    });
    const chip = document.querySelector<HTMLButtonElement>("[data-xro-quick-rule='keyword']");
    expect(chip?.textContent).toContain("拦截关键词");
    chip?.click();
    expect(onAddKeyword).toHaveBeenCalledWith("Limited GIVEAWAY today");

    selection.removeAllRanges();
    const name = document.querySelector("[data-testid='User-Name'] a")!;
    const nameRange = document.createRange();
    nameRange.selectNodeContents(name);
    selection.addRange(nameRange);
    refreshKeywordQuickRule(document, {
      locale: "zh-CN",
      enabled: true,
      onAddKeyword,
    });
    expect(document.querySelector("[data-xro-quick-rule='keyword']")).toBeNull();
    removeQuickRuleActions(document);
  });

  it("adds a Not Brother item to the tweet more menu for the post author", () => {
    const doc = fixture(`
      <article data-testid="tweet">
        <div data-testid="Tweet-User-Avatar"><a href="/Alice"><img alt=""></a></div>
        <div data-testid="User-Name"><a href="/Alice">@Alice</a></div>
        <button data-testid="caret" aria-expanded="true">More</button>
        <div data-testid="tweetText">hello @Mention</div>
      </article>
      <div data-testid="Dropdown">
        <div role="menu">
          <div role="menuitem">Not interested in this post</div>
          <div role="menuitem">Block @Alice</div>
        </div>
      </div>
    `);
    const onAddHandle = vi.fn();
    refreshTweetMenuQuickRules(doc, {
      locale: "zh-CN",
      viewerHandle: "Viewer",
      enabled: true,
      blockedHandles: new Set(),
      onAddHandle,
      onAddKeyword: vi.fn(),
    });
    const menu = doc.querySelector('[role="menu"]')!;
    const item = menu.firstElementChild as HTMLElement | null;
    expect(item?.getAttribute("data-xro-quick-rule")).toBe("menu");
    expect(item?.textContent).toContain("不是兄弟");
    item?.click();
    expect(onAddHandle).toHaveBeenCalledWith("Alice");
    expect(onAddHandle).toHaveBeenCalledTimes(1);
  });

  it("paints an already-listed more-menu author", () => {
    const doc = fixture(`
      <article data-testid="tweet">
        <div data-testid="Tweet-User-Avatar"><a href="/Blocked"><img alt=""></a></div>
        <button data-testid="caret" aria-expanded="true">More</button>
      </article>
      <div data-testid="Dropdown"><div role="menu"><div role="menuitem">Mute</div></div></div>
    `);
    refreshTweetMenuQuickRules(doc, {
      locale: "en",
      viewerHandle: "viewer",
      enabled: true,
      blockedHandles: new Set(["blocked"]),
      onAddHandle: vi.fn(),
      onAddKeyword: vi.fn(),
    });
    const item = doc.querySelector<HTMLElement>("[data-xro-quick-rule='menu']");
    expect(item?.textContent).toContain("Already");
    expect(item?.dataset.xroAdded).toBe("true");
  });

  it("does not inject a more-menu item for the signed-in viewer or a closed caret", () => {
    const doc = fixture(`
      <article data-testid="tweet">
        <div data-testid="Tweet-User-Avatar"><a href="/Viewer"><img alt=""></a></div>
        <button data-testid="caret" aria-expanded="true">More</button>
      </article>
      <article data-testid="tweet">
        <div data-testid="Tweet-User-Avatar"><a href="/Alice"><img alt=""></a></div>
        <button data-testid="caret" aria-expanded="false">More</button>
      </article>
      <div data-testid="Dropdown"><div role="menu"><div role="menuitem">Mute</div></div></div>
    `);
    refreshTweetMenuQuickRules(doc, {
      locale: "en",
      viewerHandle: "viewer",
      enabled: true,
      blockedHandles: new Set(),
      onAddHandle: vi.fn(),
      onAddKeyword: vi.fn(),
    });
    expect(doc.querySelector("[data-xro-quick-rule='menu']")).toBeNull();
  });
});

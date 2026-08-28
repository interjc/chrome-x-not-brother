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

  it("places the HoverCard action next to the name instead of the card footer", () => {
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
    const button = doc.querySelector("[data-xro-quick-rule='handle']");
    expect(name?.nextElementSibling).toBe(button);
    expect(button?.nextElementSibling?.textContent).toContain("long bio");
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
    expect(buttons[0]?.textContent).toContain("Already");
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

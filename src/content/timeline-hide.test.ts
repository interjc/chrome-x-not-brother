import { describe, expect, it, vi } from "vitest";
import type { UserRecord } from "../domain/types";
import { createEmptyFilterRuleSet } from "../domain/filter-rules";
import { compileFilterRuleSet } from "../domain/filter-rule-matching";
import {
  applyTimelineHiding,
  createMuteMemory,
  HIDDEN_TWEET_ATTRIBUTE,
  HIDING_TWEET_ATTRIBUTE,
  HIDE_ANIMATION_MS,
  hidableTweetCell,
  shouldHideTimelineAuthor,
} from "./timeline-hide";
import type { ExtractedCandidate } from "./x-adapter";

function fixture(body: string): Document {
  return new DOMParser().parseFromString(`<html><body>${body}</body></html>`, "text/html");
}

function record(handle: string, relationship: UserRecord["currentRelationship"]): UserRecord {
  return {
    key: handle.toLowerCase(),
    handle,
    displayName: handle,
    avatarUrl: null,
    profileUrl: `https://x.com/${handle}`,
    currentRelationship: relationship,
    previousRelationship: null,
    hasChanged: false,
    changeDetectedAt: null,
    firstSeenAt: 1,
    lastSeenAt: 2,
    observationCount: 1,
    lastSourceUrl: "https://x.com/home",
    lastSourceType: "timeline",
    latestEvidence: ["page-user-entity"],
  };
}

function candidate(
  doc: Document,
  handle: string,
  extras: Partial<ExtractedCandidate["observation"]> = {},
): ExtractedCandidate {
  const area = doc.querySelector<HTMLElement>(`[data-handle="${handle.toLowerCase()}"]`) ??
    doc.querySelector<HTMLElement>('[data-testid="User-Name"]')!;
  return {
    observation: {
      userKey: handle.toLowerCase(),
      handle,
      displayName: handle,
      avatarUrl: null,
      profileUrl: `https://x.com/${handle}`,
      observedAt: 1,
      sourceUrl: "https://x.com/home",
      sourceType: "timeline",
      relationship: "mutual",
      evidence: ["page-user-entity"],
      ...extras,
    },
    anchor: area,
  };
}

describe("timeline hide policy", () => {
  it("hides muted authors even when the relationship is mutual", () => {
    expect(shouldHideTimelineAuthor({
      sourceType: "timeline",
      hideMutedAccounts: true,
      hideBlockedByAccounts: false,
      muting: true,
      blockedBy: false,
      observedRelationship: "mutual",
      storedRelationship: "mutual",
    })).toBe(true);
  });

  it("does not hide muted authors while the option is off", () => {
    expect(shouldHideTimelineAuthor({
      sourceType: "timeline",
      hideMutedAccounts: false,
      hideBlockedByAccounts: false,
      muting: true,
      blockedBy: false,
      observedRelationship: "mutual",
      storedRelationship: "mutual",
    })).toBe(false);
  });

  it("hides stored blocked-by authors on Home, search, notifications, and threads", () => {
    const blocked = {
      hideMutedAccounts: false,
      hideBlockedByAccounts: true,
      muting: null as boolean | null,
      blockedBy: null as boolean | null,
      observedRelationship: "unknown" as const,
      storedRelationship: "blocked_by" as const,
    };
    expect(shouldHideTimelineAuthor({ ...blocked, sourceType: "timeline" })).toBe(true);
    expect(shouldHideTimelineAuthor({ ...blocked, sourceType: "search" })).toBe(true);
    expect(shouldHideTimelineAuthor({ ...blocked, sourceType: "notifications" })).toBe(true);
    expect(shouldHideTimelineAuthor({ ...blocked, sourceType: "thread" })).toBe(true);
    expect(shouldHideTimelineAuthor({ ...blocked, sourceType: "unknown" })).toBe(true);
    expect(shouldHideTimelineAuthor({ ...blocked, sourceType: "profile" })).toBe(false);
    expect(shouldHideTimelineAuthor({ ...blocked, sourceType: "following" })).toBe(false);
    expect(shouldHideTimelineAuthor({ ...blocked, sourceType: "followers" })).toBe(false);
  });

  it("remembers muting after a later card omits the field", () => {
    const memory = createMuteMemory();
    expect(memory.has("alice")).toBe(false);
    expect(memory.remember("alice", true)).toBe(true);
    expect(memory.has("alice")).toBe(true);
    expect(memory.remember("alice", null)).toBe(true);
    expect(memory.remember("alice", false)).toBe(false);
    expect(memory.has("alice")).toBe(false);
    expect(memory.remember("alice", null)).toBe(null);
  });
});

describe("timeline hide DOM", () => {
  it("hides the tweet cell and orphan social context, then restores them", () => {
    const doc = fixture(`
      <div data-testid="cellInnerDiv">
        <div data-testid="socialContext">MutedUser reposted</div>
      </div>
      <div data-testid="cellInnerDiv">
        <article data-testid="tweet">
          <div data-testid="User-Name" data-handle="muteduser"><a href="/MutedUser">MutedUser</a></div>
        </article>
      </div>
      <div data-testid="cellInnerDiv">
        <article data-testid="tweet">
          <div data-testid="User-Name" data-handle="visible"><a href="/Visible">Visible</a></div>
        </article>
      </div>`);
    const muted = candidate(doc, "MutedUser");
    const visible = candidate(doc, "Visible");
    const muteMemory = createMuteMemory();
    const pageUsers = new Map([
      ["muteduser", {
        handle: "MutedUser",
        following: true,
        followsYou: true,
        blockedBy: false,
        muting: true,
        displayName: "MutedUser",
        avatarUrl: null,
      }],
    ]);

    applyTimelineHiding({
      root: doc,
      candidates: [muted, visible],
      hideMutedAccounts: true,
      hideBlockedByAccounts: false,
      pageUsers,
      records: new Map(),
      muteMemory,
    });

    const cells = [...doc.querySelectorAll('[data-testid="cellInnerDiv"]')];
    expect(cells[0]?.hasAttribute(HIDDEN_TWEET_ATTRIBUTE)).toBe(true);
    expect(cells[1]?.hasAttribute(HIDDEN_TWEET_ATTRIBUTE)).toBe(true);
    expect(cells[2]?.hasAttribute(HIDDEN_TWEET_ATTRIBUTE)).toBe(false);

    applyTimelineHiding({
      root: doc,
      candidates: [muted, visible],
      hideMutedAccounts: false,
      hideBlockedByAccounts: false,
      pageUsers,
      records: new Map(),
      muteMemory,
    });
    expect(doc.querySelectorAll(`[${HIDDEN_TWEET_ATTRIBUTE}]`)).toHaveLength(0);
  });

  it("hides a live or archived blocked-by author", () => {
    const doc = fixture(`
      <div data-testid="cellInnerDiv">
        <article data-testid="tweet">
          <div data-testid="User-Name" data-handle="blocker"><a href="/Blocker">Blocker</a></div>
        </article>
      </div>`);
    applyTimelineHiding({
      root: doc,
      candidates: [candidate(doc, "Blocker", { relationship: "unknown" })],
      hideMutedAccounts: false,
      hideBlockedByAccounts: true,
      pageUsers: new Map(),
      records: new Map([["blocker", record("Blocker", "blocked_by")]]),
      muteMemory: createMuteMemory(),
    });
    expect(
      doc.querySelector('[data-testid="cellInnerDiv"]')?.hasAttribute(HIDDEN_TWEET_ATTRIBUTE),
    ).toBe(true);
  });

  it("hides by handle, display name, or current post content rules", () => {
    const doc = fixture(`
      <div data-testid="cellInnerDiv">
        <article data-testid="tweet">
          <div data-testid="User-Name" data-handle="promoter"><a href="/Promoter">Promoter</a></div>
          <div data-testid="tweetText">Limited GIVEAWAY today</div>
        </article>
      </div>`);
    const filterRules = compileFilterRuleSet({
      ...createEmptyFilterRuleSet(),
      rules: [{
        id: "content",
        label: "Giveaways",
        enabled: true,
        expiresAt: null,
        type: "content",
        match: { mode: "regex", value: "giveaway\\s+today", caseSensitive: false },
      }],
    });

    applyTimelineHiding({
      root: doc,
      candidates: [candidate(doc, "Promoter", { displayName: "Official Promoter" })],
      hideMutedAccounts: false,
      hideBlockedByAccounts: false,
      filterRules,
      pageUsers: new Map(),
      records: new Map(),
      muteMemory: createMuteMemory(),
    });

    expect(
      doc.querySelector('[data-testid="cellInnerDiv"]')?.hasAttribute(HIDDEN_TWEET_ATTRIBUTE),
    ).toBe(true);
  });

  it("reveals rule-hidden posts when custom filtering is disabled", () => {
    const doc = fixture(`
      <div data-testid="cellInnerDiv">
        <article data-testid="tweet">
          <div data-testid="User-Name" data-handle="alice"><a href="/Alice">Alice</a></div>
        </article>
      </div>`);
    const alice = candidate(doc, "Alice");
    const filterRules = compileFilterRuleSet({
      ...createEmptyFilterRuleSet(),
      rules: [{
        id: "alice",
        label: "Alice",
        enabled: true,
        expiresAt: null,
        type: "user_handles",
        handles: ["alice"],
      }],
    });
    const commonInput = {
      root: doc,
      candidates: [alice],
      hideMutedAccounts: false,
      hideBlockedByAccounts: false,
      pageUsers: new Map(),
      records: new Map(),
      muteMemory: createMuteMemory(),
    };

    applyTimelineHiding({ ...commonInput, filterRules });
    expect(doc.querySelectorAll(`[${HIDDEN_TWEET_ATTRIBUTE}]`)).toHaveLength(1);
    applyTimelineHiding(commonInput);
    expect(doc.querySelectorAll(`[${HIDDEN_TWEET_ATTRIBUTE}]`)).toHaveLength(0);
  });

  it("hides listed muted or blocked-by authors immediately without animation", () => {
    const doc = fixture(`
      <div data-testid="cellInnerDiv">
        <article data-testid="tweet">
          <div data-testid="User-Name" data-handle="listed"><a href="/Listed">Listed</a></div>
        </article>
      </div>`);
    const cell = doc.querySelector<HTMLElement>('[data-testid="cellInnerDiv"]')!;
    cell.getBoundingClientRect = () =>
      ({ height: 160, width: 400, top: 0, left: 0, bottom: 160, right: 400, x: 0, y: 0, toJSON() {} });
    applyTimelineHiding({
      root: doc,
      candidates: [candidate(doc, "Listed")],
      hideMutedAccounts: true,
      hideBlockedByAccounts: false,
      pageUsers: new Map([
        ["listed", {
          handle: "Listed",
          following: true,
          followsYou: true,
          blockedBy: false,
          muting: true,
          displayName: "Listed",
          avatarUrl: null,
        }],
      ]),
      records: new Map([["listed", record("Listed", "mutual")]]),
      muteMemory: createMuteMemory(),
    });
    expect(cell.hasAttribute(HIDDEN_TWEET_ATTRIBUTE)).toBe(true);
    expect(cell.hasAttribute(HIDING_TWEET_ATTRIBUTE)).toBe(false);
  });

  it("animates the first hide of an account that is not yet in the list", () => {
    vi.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() { return false; },
      }),
    });
    document.body.innerHTML = `
      <div data-testid="cellInnerDiv">
        <article data-testid="tweet">
          <div data-testid="User-Name" data-handle="newbie"><a href="/Newbie">Newbie</a></div>
        </article>
      </div>`;
    const cell = document.querySelector<HTMLElement>('[data-testid="cellInnerDiv"]')!;
    vi.spyOn(cell, "getBoundingClientRect").mockReturnValue({
      height: 160,
      width: 400,
      top: 0,
      left: 0,
      bottom: 160,
      right: 400,
      x: 0,
      y: 0,
      toJSON() { return {}; },
    });
    applyTimelineHiding({
      root: document,
      candidates: [candidate(document, "Newbie")],
      hideMutedAccounts: true,
      hideBlockedByAccounts: false,
      pageUsers: new Map([
        ["newbie", {
          handle: "Newbie",
          following: true,
          followsYou: true,
          blockedBy: false,
          muting: true,
          displayName: "Newbie",
          avatarUrl: null,
        }],
      ]),
      records: new Map(),
      muteMemory: createMuteMemory(),
    });
    expect(cell.hasAttribute(HIDING_TWEET_ATTRIBUTE)).toBe(true);
    expect(cell.hasAttribute(HIDDEN_TWEET_ATTRIBUTE)).toBe(false);
    vi.advanceTimersByTime(HIDE_ANIMATION_MS + 80);
    expect(cell.hasAttribute(HIDING_TWEET_ATTRIBUTE)).toBe(false);
    expect(cell.hasAttribute(HIDDEN_TWEET_ATTRIBUTE)).toBe(true);
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("does not hide profile-page tweets that match a custom handle rule", () => {
    const doc = fixture(`
      <div data-testid="cellInnerDiv">
        <article data-testid="tweet">
          <div data-testid="User-Name" data-handle="listed"><a href="/Listed">Listed</a></div>
        </article>
      </div>`);
    const filterRules = compileFilterRuleSet({
      ...createEmptyFilterRuleSet(),
      rules: [{
        id: "listed",
        label: "Listed",
        enabled: true,
        expiresAt: null,
        type: "user_handles",
        handles: ["listed"],
      }],
    });
    applyTimelineHiding({
      root: doc,
      candidates: [candidate(doc, "Listed", {
        sourceType: "profile",
        sourceUrl: "https://x.com/Listed",
      })],
      hideMutedAccounts: false,
      hideBlockedByAccounts: false,
      filterRules,
      pageUsers: new Map(),
      records: new Map(),
      muteMemory: createMuteMemory(),
    });
    expect(doc.querySelectorAll(`[${HIDDEN_TWEET_ATTRIBUTE}]`)).toHaveLength(0);
  });

  it("does not hide hover cards, user cells, or profile-only name rows", () => {
    const doc = fixture(`
      <div data-testid="HoverCard">
        <article data-testid="tweet">
          <div data-testid="User-Name"><a href="/MutedUser">MutedUser</a></div>
        </article>
      </div>
      <div data-testid="UserCell">
        <article data-testid="tweet">
          <div data-testid="User-Name"><a href="/MutedUser">MutedUser</a></div>
        </article>
      </div>
      <div data-testid="primaryColumn">
        <div data-testid="User-Name"><a href="/MutedUser">MutedUser</a></div>
      </div>`);
    const anchors = [...doc.querySelectorAll<HTMLElement>('[data-testid="User-Name"]')];
    expect(anchors.map((anchor) => hidableTweetCell(anchor))).toEqual([null, null, null]);
  });

  it("counts tweet cells by hide reason and reads status ids without post text", () => {
    const doc = fixture(`
      <div data-testid="cellInnerDiv">
        <article data-testid="tweet">
          <div data-testid="User-Name" data-handle="promoter">
            <a href="/Promoter">Promoter</a>
          </div>
          <a href="/Promoter/status/1234567890">permalink</a>
          <div data-testid="tweetText">Limited GIVEAWAY today</div>
        </article>
      </div>
      <div data-testid="cellInnerDiv">
        <article data-testid="tweet">
          <div data-testid="User-Name" data-handle="muted">
            <a href="/Muted">Muted</a>
          </div>
          <a href="/Muted/status/987">permalink</a>
        </article>
      </div>`);
    const filterRules = compileFilterRuleSet({
      ...createEmptyFilterRuleSet(),
      rules: [{
        id: "content",
        label: "Giveaways",
        enabled: true,
        expiresAt: null,
        type: "content",
        match: { mode: "regex", value: "giveaway\\s+today", caseSensitive: false },
      }],
    });
    const muteMemory = createMuteMemory();
    muteMemory.remember("muted", true);

    const count = applyTimelineHiding({
      root: doc,
      candidates: [
        candidate(doc, "Promoter", { displayName: "Official Promoter" }),
        candidate(doc, "Muted"),
      ],
      hideMutedAccounts: true,
      hideBlockedByAccounts: false,
      filterRules,
      pageUsers: new Map(),
      records: new Map(),
      muteMemory,
    });

    expect(count.pageHiddenTotal).toBe(2);
    expect(count.pageHiddenByRules).toBe(1);
    expect(count.pageHiddenByMuted).toBe(1);
    expect(count.discoveries.map((item) => item.statusId).toSorted()).toEqual(["1234567890", "987"]);
  });
});

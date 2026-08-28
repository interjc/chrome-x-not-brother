import type { RelationshipKind, SourceType, UserRecord } from "../domain/types";
import type { CompiledFilterRuleSet } from "../domain/filter-rule-matching";
import type { PageUserRelationship } from "./page-store";
import { postTextForCandidate, type ExtractedCandidate } from "./x-adapter";

export const HIDDEN_TWEET_ATTRIBUTE = "data-xro-hidden-tweet";
export const HIDING_TWEET_ATTRIBUTE = "data-xro-hiding-tweet";
export const HIDE_ANIMATION_MS = 280;

export const HIDABLE_SOURCE_TYPES = new Set<SourceType>([
  "timeline",
  "search",
  "notifications",
  "thread",
  "unknown",
]);

export interface MuteMemory {
  has(userKey: string): boolean;
  remember(userKey: string, muting: boolean | null): boolean | null;
  clear(): void;
}

export function createMuteMemory(): MuteMemory {
  const muted = new Set<string>();
  return {
    has(userKey: string): boolean {
      return muted.has(userKey);
    },
    remember(userKey: string, muting: boolean | null): boolean | null {
      if (muting === true) {
        muted.add(userKey);
        return true;
      }
      if (muting === false) {
        muted.delete(userKey);
        return false;
      }
      return muted.has(userKey) ? true : null;
    },
    clear() {
      muted.clear();
    },
  };
}

export function shouldHideTimelineAuthor(input: {
  sourceType: SourceType;
  hideMutedAccounts: boolean;
  hideBlockedByAccounts: boolean;
  muting: boolean | null;
  blockedBy: boolean | null;
  observedRelationship: RelationshipKind;
  storedRelationship: RelationshipKind | null | undefined;
}): boolean {
  if (!HIDABLE_SOURCE_TYPES.has(input.sourceType)) return false;
  if (input.hideMutedAccounts && input.muting === true) return true;
  if (!input.hideBlockedByAccounts) return false;
  return input.blockedBy === true ||
    input.observedRelationship === "blocked_by" ||
    input.storedRelationship === "blocked_by";
}

export function hidableTweetCell(anchor: HTMLElement): HTMLElement | null {
  if (anchor.closest('[data-testid="HoverCard"]')) return null;
  if (anchor.closest('[data-testid="UserCell"]')) return null;
  const article = anchor.closest<HTMLElement>('article[data-testid="tweet"]');
  if (!article) return null;
  return article.closest<HTMLElement>('[data-testid="cellInnerDiv"]') ?? article;
}

function orphanSocialContext(cell: HTMLElement): HTMLElement | null {
  const previous = cell.previousElementSibling;
  if (!(previous instanceof HTMLElement)) return null;
  if (previous.querySelector("article[data-testid='tweet']")) return null;
  if (!previous.querySelector('[data-testid="socialContext"]')) return null;
  return previous;
}

function prefersReducedMotion(element: HTMLElement): boolean {
  return Boolean(
    element.ownerDocument.defaultView
      ?.matchMedia("(prefers-reduced-motion: reduce)")
      .matches,
  );
}

function clearHideStyles(cell: HTMLElement): void {
  cell.style.boxSizing = "";
  cell.style.height = "";
  cell.style.marginTop = "";
  cell.style.marginBottom = "";
  cell.style.opacity = "";
  cell.style.overflow = "";
  cell.style.paddingTop = "";
  cell.style.paddingBottom = "";
  cell.style.transition = "";
}

function finishHide(cell: HTMLElement): void {
  cell.removeAttribute(HIDING_TWEET_ATTRIBUTE);
  cell.setAttribute(HIDDEN_TWEET_ATTRIBUTE, "");
  clearHideStyles(cell);
}

export function revealTweetCell(cell: HTMLElement): void {
  cell.removeAttribute(HIDDEN_TWEET_ATTRIBUTE);
  cell.removeAttribute(HIDING_TWEET_ATTRIBUTE);
  clearHideStyles(cell);
}

export function collapseTweetCell(cell: HTMLElement, animate = true): void {
  if (
    cell.hasAttribute(HIDDEN_TWEET_ATTRIBUTE) ||
    cell.hasAttribute(HIDING_TWEET_ATTRIBUTE)
  ) return;
  const view = cell.ownerDocument.defaultView;
  const height = cell.getBoundingClientRect().height;
  if (!animate || !view || prefersReducedMotion(cell) || height < 1) {
    cell.setAttribute(HIDDEN_TWEET_ATTRIBUTE, "");
    return;
  }
  cell.style.boxSizing = "border-box";
  cell.style.overflow = "hidden";
  cell.style.height = `${Math.round(height)}px`;
  cell.setAttribute(HIDING_TWEET_ATTRIBUTE, "");
  void cell.getBoundingClientRect();
  cell.style.transition =
    `height ${HIDE_ANIMATION_MS}ms ease, opacity ${HIDE_ANIMATION_MS}ms ease, ` +
    `margin ${HIDE_ANIMATION_MS}ms ease, padding ${HIDE_ANIMATION_MS}ms ease`;
  cell.style.height = "0px";
  cell.style.opacity = "0";
  cell.style.marginTop = "0px";
  cell.style.marginBottom = "0px";
  cell.style.paddingTop = "0px";
  cell.style.paddingBottom = "0px";
  let finished = false;
  const done = (): void => {
    if (finished) return;
    finished = true;
    view.clearTimeout(timer);
    cell.removeEventListener("transitionend", onEnd);
    if (!cell.hasAttribute(HIDING_TWEET_ATTRIBUTE)) return;
    finishHide(cell);
  };
  const onEnd = (event: Event): void => {
    if (event.target !== cell) return;
    if (
      event instanceof TransitionEvent &&
      event.propertyName &&
      event.propertyName !== "height"
    ) return;
    done();
  };
  cell.addEventListener("transitionend", onEnd);
  const timer = view.setTimeout(done, HIDE_ANIMATION_MS + 80);
}

export function clearTimelineHiding(root: ParentNode = document): void {
  for (const node of root.querySelectorAll(
    `[${HIDDEN_TWEET_ATTRIBUTE}], [${HIDING_TWEET_ATTRIBUTE}]`,
  )) {
    if (node instanceof HTMLElement) revealTweetCell(node);
  }
}

export interface TimelineHideReasons {
  byRules: boolean;
  byMuted: boolean;
  byBlockedBy: boolean;
}

export interface TimelineHideDiscovery extends TimelineHideReasons {
  statusId: string | null;
}

export interface TimelineHideCount {
  pageHiddenTotal: number;
  pageHiddenByRules: number;
  pageHiddenByMuted: number;
  pageHiddenByBlockedBy: number;
  discoveries: TimelineHideDiscovery[];
}

export function emptyTimelineHideCount(): TimelineHideCount {
  return {
    pageHiddenTotal: 0,
    pageHiddenByRules: 0,
    pageHiddenByMuted: 0,
    pageHiddenByBlockedBy: 0,
    discoveries: [],
  };
}

const STATUS_ID_PATTERN = /\/(?:i\/web\/)?status\/(\d+)/;

export function tweetStatusId(cell: HTMLElement): string | null {
  for (const link of cell.querySelectorAll("a[href]")) {
    const href = link.getAttribute("href") ?? "";
    const match = STATUS_ID_PATTERN.exec(href);
    if (match?.[1]) return match[1];
  }
  return null;
}

function isTweetArticleCell(cell: HTMLElement): boolean {
  return cell.matches('article[data-testid="tweet"]') ||
    Boolean(cell.querySelector('article[data-testid="tweet"]'));
}

export function applyTimelineHiding(input: {
  root?: ParentNode;
  candidates: ExtractedCandidate[];
  hideMutedAccounts: boolean;
  hideBlockedByAccounts: boolean;
  filterRules?: CompiledFilterRuleSet | null;
  pageUsers: Map<string, PageUserRelationship>;
  records: Map<string, UserRecord>;
  muteMemory: MuteMemory;
}): TimelineHideCount {
  const root = input.root ?? document;
  const desired = new Map<HTMLElement, boolean>();
  const reasons = new Map<HTMLElement, TimelineHideReasons>();
  const addCell = (
    cell: HTMLElement,
    animate: boolean,
    next: TimelineHideReasons,
  ): void => {
    const current = desired.get(cell);
    desired.set(cell, current === undefined ? animate : current && animate);
    const existing = reasons.get(cell);
    reasons.set(cell, {
      byRules: Boolean(existing?.byRules || next.byRules),
      byMuted: Boolean(existing?.byMuted || next.byMuted),
      byBlockedBy: Boolean(existing?.byBlockedBy || next.byBlockedBy),
    });
  };
  if (input.hideMutedAccounts || input.hideBlockedByAccounts || input.filterRules) {
    for (const candidate of input.candidates) {
      if (!HIDABLE_SOURCE_TYPES.has(candidate.observation.sourceType)) continue;
      const userKey = candidate.observation.userKey;
      const pageUser = input.pageUsers.get(userKey);
      const alreadyKnown =
        input.muteMemory.has(userKey) || input.records.has(userKey);
      const muting = input.muteMemory.remember(userKey, pageUser?.muting ?? null);
      const byMuted = input.hideMutedAccounts && muting === true;
      const byBlockedBy = input.hideBlockedByAccounts && (
        pageUser?.blockedBy === true ||
        candidate.observation.relationship === "blocked_by" ||
        input.records.get(userKey)?.currentRelationship === "blocked_by"
      );
      const matchingRule = input.filterRules?.match({
        userKey,
        displayName: candidate.observation.displayName,
        contentText: postTextForCandidate(candidate.anchor),
      }) ?? null;
      const byRules = Boolean(matchingRule);
      if (!byMuted && !byBlockedBy && !byRules) continue;
      const cell = hidableTweetCell(candidate.anchor);
      if (!cell) continue;
      const animate = byRules || !alreadyKnown;
      const next = { byRules, byMuted, byBlockedBy };
      addCell(cell, animate, next);
      const context = orphanSocialContext(cell);
      if (context) addCell(context, animate, next);
    }
  }

  for (const node of root.querySelectorAll(
    `[${HIDDEN_TWEET_ATTRIBUTE}], [${HIDING_TWEET_ATTRIBUTE}]`,
  )) {
    if (node instanceof HTMLElement && !desired.has(node)) revealTweetCell(node);
  }
  for (const [cell, animate] of desired) collapseTweetCell(cell, animate);

  const count = emptyTimelineHideCount();
  for (const [cell, reason] of reasons) {
    if (!isTweetArticleCell(cell)) continue;
    count.pageHiddenTotal += 1;
    if (reason.byRules) count.pageHiddenByRules += 1;
    if (reason.byMuted) count.pageHiddenByMuted += 1;
    if (reason.byBlockedBy) count.pageHiddenByBlockedBy += 1;
    count.discoveries.push({
      statusId: tweetStatusId(cell),
      ...reason,
    });
  }
  return count;
}

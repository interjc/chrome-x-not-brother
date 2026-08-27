import {
  isUsableDisplayName,
  normalizeProfileImageUrl,
} from "../domain/identity";
import { resolveRelationship } from "../domain/relationships";
import type {
  EvidenceType,
  ObservationDraft,
  RelationshipFacts,
  SourceType,
} from "../domain/types";

export interface ExtractedCandidate {
  observation: ObservationDraft;
  anchor: HTMLElement;
  acceptPageStoreRelationship?: boolean;
}

const HANDLE_PATTERN = /^@?([A-Za-z0-9_]{1,15})$/;
export const USER_NAME_SELECTOR =
  '[data-testid="UserName"], [data-testid="User-Name"], [data-testid="User-Names"]';
const TWEET_SURFACE_SELECTOR = 'article[data-testid="tweet"], [data-testid="UserCell"]';
export const USER_CONTENT_SELECTOR =
  '[data-testid="tweetText"], [data-testid="card.layoutLarge.media"]';
const SUGGESTION_DIRECTORY_LINK_SELECTOR =
  'a[href*="/i/connect_people"], a[href*="/i/related_users"]';
const SUGGESTION_CHROME_SKIP_SELECTOR =
  '[data-testid="UserCell"], article, [data-testid="tweet"]';
const AVATAR_LINK_SELECTOR =
  '[data-testid="Tweet-User-Avatar"] a[href], [data-testid="UserAvatar-Container"] a[href], [data-testid^="UserAvatar-Container-"] a[href]';
const AVATAR_CONTAINER_SELECTOR =
  '[data-testid="Tweet-User-Avatar"], [data-testid="UserAvatar-Container"], [data-testid^="UserAvatar-Container-"]';
const RESERVED_PATHS = new Set([
  "home",
  "explore",
  "notifications",
  "messages",
  "i",
  "settings",
  "compose",
  "search",
  "jobs",
  "communities",
  "tos",
  "privacy",
]);
const PROFILE_SUBPATHS = new Set([
  "status",
  "with_replies",
  "highlights",
  "articles",
  "media",
  "likes",
  "superfollows",
  "photo",
  "header_photo",
  "followers",
  "following",
  "verified_followers",
  "creator-subscriptions",
]);
const FORMAT_CHARS = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;

const BLOCKED_PATTERNS = [
  /you(?:'|’)?re blocked/i,
  /has blocked you/i,
  /(?:this|the) (?:post|tweet) is (?:from|by) an account (?:that|who) (?:has )?blocked you/i,
  /account (?:that|who) (?:has )?blocked you[^.]* (?:post|tweet)/i,
  /ブロックされています/u,
  /あなたをブロック/u,
  /このポストは[^。]*(?:あなたをブロック|ブロックされています)/u,
  /你已被(?:屏蔽|拉黑)/u,
  /已将你拉黑/u,
  /已封鎖你/u,
  /(?:此|这)(?:帖子|貼文|贴文|則貼文|则贴文)[^。]*(?:屏蔽|拉黑|封鎖)了?你/u,
  /来自已(?:屏蔽|拉黑|封鎖)你的(?:账号|帳號)/u,
  /(?:此|这)(?:帖子|貼文|贴文|則貼文|则贴文)[^。]*(?:来自|來自)[^。]*(?:屏蔽|拉黑|封鎖)你/u,
];

const FOLLOWS_YOU_PATTERNS = [
  /follows you/i,
  /フォローされています/u,
  /关注了你/u,
  /正在关注你/u,
  /已關注你/u,
];

const SUGGESTION_HEADING_PATTERNS = [
  /who to follow/i,
  /you might like/i,
  /similar accounts/i,
  /suggested (?:accounts|users|for you)/i,
  /跟隨誰/u,
  /关注谁/u,
  /關注誰/u,
  /推荐关注/u,
  /推薦關注/u,
  /建议关注/u,
  /建議關注/u,
  /你可能[会會]喜欢/u,
  /你可能[会會]喜歡/u,
  /类似账号/u,
  /類似帳號/u,
  /おすすめ(?:の)?(?:ユーザー|アカウント)/u,
];

export function isInsideXUserAuthoredContent(node: Node): boolean {
  const element = node instanceof Element ? node : node.parentElement;
  return Boolean(element?.closest(USER_CONTENT_SELECTOR));
}

function* elementsMatching<T extends Element>(
  root: Element,
  selector: string,
  skipSelector: string,
): Generator<T> {
  const stack: Element[] = [root];
  while (stack.length > 0) {
    const element = stack.pop()!;
    if (element !== root && element.matches(skipSelector)) continue;
    if (element.matches(selector)) yield element as T;
    const children = element.children;
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push(children[index]!);
    }
  }
}

export function* iterateOutsideUserContent<T extends Element>(
  root: Element,
  selector: string,
): Generator<T> {
  yield* elementsMatching<T>(root, selector, USER_CONTENT_SELECTOR);
}

function textExcluding(element: Element, skipSelector: string): string {
  const parts: string[] = [];
  const visit = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.textContent;
      if (value) parts.push(value);
      return;
    }
    if (!(node instanceof Element)) return;
    if (node !== element && node.matches(skipSelector)) return;
    const children = node.childNodes;
    for (let index = 0; index < children.length; index += 1) {
      visit(children[index]!);
    }
  };
  visit(element);
  return parts.join("").normalize("NFKC");
}

function platformText(element: Element): string {
  return textExcluding(element, USER_CONTENT_SELECTOR);
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function isSemanticallyVisible(element: HTMLElement): boolean {
  let current: HTMLElement | null = element;
  while (current) {
    if (
      current.hidden ||
      current.hasAttribute("inert") ||
      current.getAttribute("aria-hidden") === "true"
    ) return false;
    const style = current.ownerDocument.defaultView?.getComputedStyle(current);
    if (
      style?.display === "none" ||
      style?.visibility === "hidden" ||
      style?.opacity === "0"
    ) return false;
    current = current.parentElement;
  }
  return true;
}

function visibleHoverCardsByHandle(doc: Document): Map<string, HTMLElement> {
  const cards = new Map<string, HTMLElement>();
  for (const card of doc.querySelectorAll<HTMLElement>('[data-testid="HoverCard"]')) {
    if (!isSemanticallyVisible(card)) continue;
    if (card.querySelector('[role="progressbar"], [data-testid="loadingSpinner"]')) continue;
    const handle = findHandle(card);
    if (!handle) continue;
    cards.set(handle.toLowerCase(), card);
  }
  return cards;
}

function hoverCardOmitsRelationshipCounts(card: Element, handle: string): boolean {
  const hasFollowingCount = card.querySelector(`a[href$="/${handle}/following" i]`);
  const hasFollowerCount = card.querySelector(
    `a[href$="/${handle}/followers" i], a[href$="/${handle}/verified_followers" i]`,
  );
  return !hasFollowingCount && !hasFollowerCount;
}

const ENGAGEMENT_SELECTORS = [
  '[data-testid="reply"]',
  '[data-testid="retweet"], [data-testid="unretweet"]',
  '[data-testid="like"], [data-testid="unlike"]',
] as const;
const DISABLED_ENGAGEMENT_SELECTOR = ':disabled, [aria-disabled="true"], [inert]';

type EngagementControlState = "missing" | "restricted" | "actionable";

function isAriaHiddenSubtree(element: HTMLElement): boolean {
  let current: HTMLElement | null = element;
  while (current) {
    if (
      Boolean(current.hidden) ||
      current.hasAttribute("inert") ||
      current.getAttribute("aria-hidden") === "true"
    ) return true;
    current = current.parentElement;
  }
  return false;
}

function computedStyleHides(element: HTMLElement): boolean {
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  return style?.display === "none" ||
    style?.visibility === "hidden" ||
    style?.opacity === "0";
}

function walkAncestorsWithinSurface(
  start: HTMLElement,
  surface: Element,
  matches: (element: HTMLElement) => boolean,
): boolean {
  let element: HTMLElement | null = start;
  while (element) {
    if (matches(element)) return true;
    if (element === surface) break;
    const parentElement: HTMLElement | null = element.parentElement;
    if (!parentElement || !surface.contains(parentElement)) break;
    element = parentElement;
  }
  return false;
}

function isRenderedEngagementTarget(element: HTMLElement, surface: Element): boolean {
  return !walkAncestorsWithinSurface(element, surface, (current) =>
    Boolean(current.hidden) ||
    current.getAttribute("aria-hidden") === "true" ||
    computedStyleHides(current),
  );
}

function isExplicitlyDisabledEngagement(element: HTMLElement, surface: Element): boolean {
  return walkAncestorsWithinSurface(element, surface, (current) =>
    current.matches(DISABLED_ENGAGEMENT_SELECTOR),
  );
}

function engagementControlState(surface: Element, selector: string): EngagementControlState {
  const control = surface.querySelector<HTMLElement>(selector);
  if (!control) return "missing";
  const interactive = control.matches('button, [role="button"], a[href]')
    ? control
    : control.querySelector<HTMLElement>('button, [role="button"], a[href]');
  const target = interactive ?? control;
  if (!isRenderedEngagementTarget(target, surface)) return "missing";
  if (isExplicitlyDisabledEngagement(target, surface)) return "restricted";
  return interactive ? "actionable" : "missing";
}

function engagementIsUnavailable(surface: Element): boolean {
  if (surface instanceof HTMLElement && isAriaHiddenSubtree(surface)) return false;
  return ENGAGEMENT_SELECTORS.every(
    (selector) => engagementControlState(surface, selector) === "restricted",
  );
}

function engagementIsAvailable(surface: Element): boolean {
  if (surface instanceof HTMLElement && isAriaHiddenSubtree(surface)) return false;
  return ENGAGEMENT_SELECTORS.every(
    (selector) => engagementControlState(surface, selector) === "actionable",
  );
}

function containingOverlay(element: Element): Element | null {
  return element.closest('[aria-modal="true"], [role="dialog"]') ??
    element.closest("#layers");
}

function actionableEngagementLayers(doc: Document): Set<Element | "page"> {
  const layers = new Set<Element | "page">();
  for (const surface of doc.querySelectorAll<HTMLElement>(
    '[data-testid="cellInnerDiv"], article',
  )) {
    if (!engagementIsAvailable(surface)) continue;
    layers.add(containingOverlay(surface) ?? "page");
  }
  return layers;
}

function cleanedText(text: string): string {
  return text.replace(FORMAT_CHARS, "").normalize("NFKC").trim();
}

export function postTextForCandidate(anchor: HTMLElement): string | null {
  const article = anchor.closest<HTMLElement>('article[data-testid="tweet"]');
  if (!article) return null;
  const parts = [...article.querySelectorAll<HTMLElement>(USER_CONTENT_SELECTOR)]
    .filter((element) =>
      element.closest('article[data-testid="tweet"]') === article &&
      !element.closest('[data-testid="HoverCard"]'),
    )
    .map((element) => cleanedText(element.textContent ?? ""))
    .filter(Boolean);
  const text = cleanedText(parts.join("\n"));
  return text || null;
}

function handleFromText(text: string, allowBare = false): string | null {
  const trimmed = cleanedText(text);
  if (!allowBare && !trimmed.startsWith("@")) return null;
  const match = trimmed.match(HANDLE_PATTERN);
  if (!match?.[1]) return null;
  return RESERVED_PATHS.has(match[1].toLowerCase()) ? null : match[1];
}

function handleFromHref(href: string | null): string | null {
  if (!href) return null;
  try {
    const url = new URL(href, "https://x.com");
    if (url.origin !== "https://x.com") return null;
    const segments = url.pathname.split("/").filter(Boolean);
    const [first, second] = segments;
    if (!first) return null;
    if (second && !PROFILE_SUBPATHS.has(second.toLowerCase())) return null;
    return handleFromText(first, true);
  } catch {
    return null;
  }
}

function isInsideNestedSurface(element: Element, surface: Element): boolean {
  const nested = element.closest("article, [data-testid='UserCell']");
  return Boolean(nested && nested !== surface && surface.contains(nested));
}

function firstDirect<T extends Element>(surface: Element, selector: string): T | null {
  for (const element of surface.querySelectorAll<T>(selector)) {
    if (!isInsideNestedSurface(element, surface)) return element;
  }
  return null;
}

function findHandle(area: Element): string | null {
  for (const element of iterateOutsideUserContent<HTMLAnchorElement>(area, "a[href]")) {
    if (isInsideNestedSurface(element, area)) continue;
    const fromHref = handleFromHref(element.getAttribute("href"));
    if (fromHref) return fromHref;
  }
  for (const element of iterateOutsideUserContent<HTMLElement>(area, "a[href], span")) {
    if (isInsideNestedSurface(element, area)) continue;
    const fromText = handleFromText(element.textContent ?? "");
    if (fromText) return fromText;
  }
  return handleFromHref(area.getAttribute("href"));
}

function authorHandleFromSurface(surface: Element): string | null {
  const avatar = firstDirect<HTMLAnchorElement>(surface, AVATAR_LINK_SELECTOR);
  const fromAvatar = handleFromHref(avatar?.getAttribute("href") ?? null);
  if (fromAvatar) return fromAvatar;
  const time = firstDirect<HTMLTimeElement>(surface, "time");
  const timeLink = time?.closest("a[href]") ?? null;
  return handleFromHref(timeLink?.getAttribute("href") ?? null);
}

function identityAnchorFromSurface(surface: HTMLElement, handle: string): HTMLElement {
  const name = firstDirect<HTMLElement>(surface, USER_NAME_SELECTOR);
  if (name) return name;
  const normalized = handle.toLowerCase();
  for (const link of iterateOutsideUserContent<HTMLAnchorElement>(surface, "a[href]")) {
    if (isInsideNestedSurface(link, surface)) continue;
    if (handleFromHref(link.getAttribute("href"))?.toLowerCase() !== normalized) continue;
    if (!link.closest(AVATAR_CONTAINER_SELECTOR) && !link.querySelector("img")) return link;
  }
  const avatar = firstDirect<HTMLElement>(surface, AVATAR_LINK_SELECTOR);
  if (avatar) return avatar;
  return surface;
}

function relationshipSurfaceFor(
  area: HTMLElement,
  sourceType: SourceType,
): HTMLElement {
  const cell = area.closest<HTMLElement>('[data-testid="cellInnerDiv"]');
  return area.closest<HTMLElement>('[data-testid="UserCell"]') ??
    (sourceType === "thread" ? cell : null) ??
    area.closest<HTMLElement>("article") ??
    cell ??
    area;
}

function suggestionHref(href: string | null): boolean {
  if (!href) return false;
  try {
    const url = new URL(href, "https://x.com");
    return url.pathname === "/i/connect_people" ||
      url.pathname.startsWith("/i/connect_people/") ||
      url.pathname === "/i/related_users" ||
      url.pathname.startsWith("/i/related_users/");
  } catch {
    return false;
  }
}

function recommendationChrome(element: Element): boolean {
  const aria = element.getAttribute("aria-label") ?? "";
  if (matchesAny(aria, SUGGESTION_HEADING_PATTERNS)) return true;
  for (const link of element.querySelectorAll<HTMLAnchorElement>(SUGGESTION_DIRECTORY_LINK_SELECTOR)) {
    if (suggestionHref(link.getAttribute("href"))) return true;
  }
  return matchesAny(
    textExcluding(element, SUGGESTION_CHROME_SKIP_SELECTOR),
    SUGGESTION_HEADING_PATTERNS,
  );
}

function isSuggestionSurface(
  surface: Element,
  cellCache?: WeakMap<Element, boolean>,
): boolean {
  const aside = surface.closest("aside");
  if (aside && !aside.closest('[data-testid="primaryColumn"]')) return true;
  const cell = surface.closest('[data-testid="cellInnerDiv"]');
  if (!cell) return false;
  const cached = cellCache?.get(cell);
  if (cached !== undefined) return cached;
  const value = recommendationChrome(cell);
  cellCache?.set(cell, value);
  return value;
}

function shouldAssumeNotFollowedBy(
  sourceType: SourceType,
  supplementalSurface: Element | null,
  suggestionSurface: boolean,
): boolean {
  if (supplementalSurface !== null) return true;
  if (suggestionSurface) return false;
  return sourceType === "following" || sourceType === "profile";
}

export function viewerHandleFromDocument(doc: Document): string | null {
  const accountSwitcher = doc.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
  const fromSwitcher = accountSwitcher ? findHandle(accountSwitcher) : null;
  if (fromSwitcher) return fromSwitcher;
  const profileLink = doc.querySelector<HTMLAnchorElement>('[data-testid="AppTabBar_Profile_Link"]');
  return handleFromHref(profileLink?.getAttribute("href") ?? null);
}

export function sourceTypeFromUrl(url: URL, viewerHandle: string | null): SourceType {
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments[0] === "search") return "search";
  if (segments[0] === "notifications") return "notifications";
  if (segments.length >= 3 && segments[1] === "status") return "thread";
  if (segments.length >= 2 && viewerHandle && segments[0]?.toLowerCase() === viewerHandle.toLowerCase()) {
    if (segments[1] === "following") return "following";
    if (segments[1] === "followers" || segments[1] === "verified_followers") return "followers";
  }
  if (segments.length === 1 && handleFromText(segments[0] ?? "", true)) return "profile";
  if (segments.length === 0 || segments[0] === "home") return "timeline";
  return "unknown";
}

function relationshipFacts(
  surface: Element,
  sourceType: SourceType,
  blockedByInteractionRestriction = false,
  blockedByProfileSummaryRestriction = false,
  supplementalSurface: Element | null = null,
  suggestionSurface = false,
): { facts: RelationshipFacts; evidence: EvidenceType[] } {
  const relationshipSurfaces = supplementalSurface
    ? [surface, supplementalSurface]
    : [surface];
  const text = relationshipSurfaces.map(platformText).join(" ");
  const evidence: EvidenceType[] = [];
  const blockedByNotice = matchesAny(text, BLOCKED_PATTERNS);
  const blockedBy = blockedByNotice ||
    blockedByInteractionRestriction ||
    blockedByProfileSummaryRestriction;
  if (blockedByNotice) evidence.push("blocked-notice");
  if (blockedByInteractionRestriction) evidence.push("blocked-interaction-restriction");
  if (blockedByProfileSummaryRestriction) {
    evidence.push("blocked-profile-summary-restriction");
  }

  const unfollowControl = relationshipSurfaces.some((area) =>
    area.querySelector('[data-testid$="-unfollow"]'));
  const followControl = relationshipSurfaces.some((area) =>
    area.querySelector('[data-testid$="-follow"]'));
  let following: boolean | null = null;
  if (unfollowControl) {
    following = true;
    evidence.push("following-control");
  } else if (followControl) {
    following = false;
    evidence.push("follow-control");
  } else if (sourceType === "following") {
    following = true;
    evidence.push("viewer-following-list");
  }

  const followsYouLabel = relationshipSurfaces.some((area) =>
    area.querySelector('[data-testid="userFollowIndicator"]')) ||
    matchesAny(text, FOLLOWS_YOU_PATTERNS);
  let followsYou: boolean | null = null;
  if (followsYouLabel) {
    followsYou = true;
    evidence.push("follows-you-label");
  } else if (sourceType === "followers") {
    followsYou = true;
    evidence.push("viewer-followers-list");
  } else if (shouldAssumeNotFollowedBy(sourceType, supplementalSurface, suggestionSurface)) {
    followsYou = false;
  }

  if (evidence.length === 0) evidence.push("insufficient-evidence");
  return { facts: { following, followsYou, blockedBy }, evidence };
}

function displayNameFromArea(area: Element, handle: string): string | null {
  const fromLink = displayNameFromProfileLink(area, handle);
  if (fromLink) return fromLink;
  const leaves: string[] = [];
  for (const element of iterateOutsideUserContent<HTMLElement>(area, "span")) {
    if (isInsideNestedSurface(element, area) || element.querySelector("span")) continue;
    const text = cleanedText(element.textContent ?? "");
    if (handleFromText(text) || !isUsableDisplayName(text, handle)) continue;
    leaves.push(text);
  }
  if (leaves.length === 0) return null;
  if (leaves.every((part) => [...part].length === 1)) {
    const joined = leaves.join("");
    return isUsableDisplayName(joined, handle) ? joined : leaves[0] ?? null;
  }
  return leaves[0] ?? null;
}

function displayNameFromProfileLink(area: Element, handle: string): string | null {
  const normalized = handle.toLowerCase();
  for (const link of iterateOutsideUserContent<HTMLAnchorElement>(area, "a[href]")) {
    if (isInsideNestedSurface(link, area)) continue;
    if (handleFromHref(link.getAttribute("href"))?.toLowerCase() !== normalized) continue;
    const text = cleanedText(link.textContent ?? "");
    const withoutHandle = cleanedText(
      text.replace(new RegExp(`@${handle}\\b`, "ig"), ""),
    );
    if (isUsableDisplayName(withoutHandle, handle)) return withoutHandle;
  }
  return null;
}

function profileImageUrlFrom(image: HTMLImageElement | null): string | null {
  if (!image) return null;
  const src = image.currentSrc || image.getAttribute("src") || "";
  const fromSrc = normalizeProfileImageUrl(src);
  if (fromSrc) return fromSrc;
  const srcset = image.getAttribute("srcset");
  if (!srcset) return null;
  const last = srcset.split(",").at(-1)?.trim().split(/\s+/)[0];
  return normalizeProfileImageUrl(last);
}

function avatarFromSurface(surface: Element, handle: string): string | null {
  const container = firstDirect<HTMLElement>(surface, AVATAR_CONTAINER_SELECTOR);
  const fromContainer = profileImageUrlFrom(container?.querySelector("img") ?? null);
  if (fromContainer) return fromContainer;
  const avatarLink = firstDirect<HTMLAnchorElement>(surface, AVATAR_LINK_SELECTOR);
  const fromAvatarLink = profileImageUrlFrom(avatarLink?.querySelector("img") ?? null);
  if (fromAvatarLink) return fromAvatarLink;
  const normalized = handle.toLowerCase();
  for (const link of iterateOutsideUserContent<HTMLAnchorElement>(surface, "a[href]")) {
    if (isInsideNestedSurface(link, surface)) continue;
    if (handleFromHref(link.getAttribute("href"))?.toLowerCase() !== normalized) continue;
    const url = profileImageUrlFrom(link.querySelector("img"));
    if (url) return url;
  }
  for (const image of iterateOutsideUserContent<HTMLImageElement>(surface, "img")) {
    if (isInsideNestedSurface(image, surface)) continue;
    const url = profileImageUrlFrom(image);
    if (url) return url;
  }
  return null;
}

function observationFor(
  handle: string,
  area: HTMLElement,
  surface: Element,
  sourceUrl: URL,
  sourceType: SourceType,
  observedAt: number,
  blockedByInteractionRestriction = false,
  blockedByProfileSummaryRestriction = false,
  supplementalSurface: Element | null = null,
  suggestionSurface = false,
): ObservationDraft {
  const { facts, evidence } = relationshipFacts(
    surface,
    sourceType,
    blockedByInteractionRestriction,
    blockedByProfileSummaryRestriction,
    supplementalSurface,
    suggestionSurface,
  );
  return {
    userKey: handle.toLowerCase(),
    handle,
    displayName: displayNameFromArea(area, handle),
    avatarUrl: avatarFromSurface(surface, handle),
    profileUrl: `https://x.com/${handle}`,
    observedAt,
    sourceUrl: sourceUrl.href,
    sourceType,
    relationship: resolveRelationship(facts),
    evidence,
  };
}

function profileCandidate(
  doc: Document,
  url: URL,
  sourceType: SourceType,
  observedAt: number,
  viewerHandle: string | null,
): ExtractedCandidate | null {
  if (sourceType !== "profile") return null;
  const handle = handleFromText(
    url.pathname.split("/").filter(Boolean)[0] ?? "",
    true,
  );
  if (viewerHandle && handle?.toLowerCase() === viewerHandle.toLowerCase()) return null;
  const area = doc.querySelector<HTMLElement>(
    `[data-testid="primaryColumn"] ${USER_NAME_SELECTOR}`,
  );
  const surface = doc.querySelector<HTMLElement>('[data-testid="primaryColumn"]');
  if (!handle || !area || !surface) return null;
  return {
    observation: observationFor(handle, area, surface, url, sourceType, observedAt),
    anchor: area,
  };
}

export function scanXDocument(
  doc: Document,
  sourceHref: string,
  observedAt = Date.now(),
): ExtractedCandidate[] {
  const url = new URL(sourceHref);
  const viewerHandle = viewerHandleFromDocument(doc);
  const sourceType = sourceTypeFromUrl(url, viewerHandle);
  const candidates: ExtractedCandidate[] = [];
  const seenAnchors = new Set<HTMLElement>();
  const visibleHoverCards = visibleHoverCardsByHandle(doc);
  const suggestionCells = new WeakMap<Element, boolean>();
  const engagementLayers = sourceType === "thread" ? actionableEngagementLayers(doc) : null;

  const addCandidate = (
    handle: string,
    area: HTMLElement,
    surface: Element,
    supplementalSurface: HTMLElement | null = null,
  ): void => {
    if (
      area.closest("[data-xro-badge]") ||
      seenAnchors.has(area) ||
      (viewerHandle && handle.toLowerCase() === viewerHandle.toLowerCase())
    ) return;
    seenAnchors.add(area);
    const hoverCard =
      supplementalSurface ??
      visibleHoverCards.get(handle.toLowerCase()) ??
      null;
    const suggestionSurface = isSuggestionSurface(surface, suggestionCells);
    const blockedByInteractionRestriction =
      sourceType === "thread" &&
      engagementIsUnavailable(surface) &&
      Boolean(engagementLayers?.has(containingOverlay(surface) ?? "page"));
    const blockedByProfileSummaryRestriction =
      sourceType === "thread" &&
      hoverCard !== null &&
      hoverCardOmitsRelationshipCounts(hoverCard, handle);
    candidates.push({
      observation: observationFor(
        handle,
        area,
        surface,
        url,
        sourceType,
        observedAt,
        blockedByInteractionRestriction,
        blockedByProfileSummaryRestriction,
        hoverCard,
        suggestionSurface,
      ),
      anchor: area,
      acceptPageStoreRelationship: !suggestionSurface,
    });
  };

  const coversHandle = (surface: Element, handle: string): boolean =>
    candidates.some((item) =>
      item.observation.userKey === handle.toLowerCase() &&
      (surface.contains(item.anchor) || item.anchor.contains(surface)),
    );

  for (const area of doc.querySelectorAll<HTMLElement>(USER_NAME_SELECTOR)) {
    const surface = relationshipSurfaceFor(area, sourceType);
    let handle = findHandle(area);
    if (!handle) {
      const primaryName = firstDirect<HTMLElement>(surface, USER_NAME_SELECTOR);
      if (primaryName === area) handle = authorHandleFromSurface(surface);
    }
    if (!handle) continue;
    addCandidate(handle, area, surface);
  }

  for (const surface of doc.querySelectorAll<HTMLElement>(TWEET_SURFACE_SELECTOR)) {
    const named = firstDirect<HTMLElement>(surface, USER_NAME_SELECTOR);
    const handle = authorHandleFromSurface(surface) ??
      (named ? findHandle(named) : findHandle(surface));
    if (!handle || coversHandle(surface, handle)) continue;
    addCandidate(handle, identityAnchorFromSurface(surface, handle), surface);
  }

  for (const [userKey, card] of visibleHoverCards) {
    if (candidates.some((item) => item.observation.userKey === userKey)) continue;
    const handle = findHandle(card) ?? userKey;
    const area = card.querySelector<HTMLElement>(USER_NAME_SELECTOR) ?? card;
    addCandidate(handle, area, card, card);
  }

  const profile = profileCandidate(doc, url, sourceType, observedAt, viewerHandle);
  if (profile) candidates.push(profile);
  return candidates;
}

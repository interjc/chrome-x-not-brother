import type { DisplayRelationship, RelationshipKind } from "../domain/types";
import { relationshipPresentation, type AppLocale } from "../i18n";
import { USER_NAME_SELECTOR } from "./x-adapter";

const BADGE_ATTRIBUTE = "data-xro-badge";
const BADGE_ROW_ATTRIBUTE = "data-xro-badge-row";
const BADGE_ROW_CLASS = "xro-name-badge-row";
const IDENTITY_ATTRIBUTE = "data-xro-relationship";
const IDENTITY_CLASSES = [
  "xro-identity-mark",
  "xro-identity-mark--following_only",
  "xro-identity-mark--blocked_by",
];
const USER_CARD_SELECTOR = '[data-testid="UserCell"], [data-testid="HoverCard"]';
const AVATAR_IDENTITY_SELECTOR =
  '[data-testid="Tweet-User-Avatar"], [data-testid="UserAvatar-Container"], [data-testid^="UserAvatar-Container-"]';
const FORMAT_CHARS = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;

function isAvatarIdentity(element: Element): boolean {
  if (element.closest(AVATAR_IDENTITY_SELECTOR)) return true;
  return element instanceof HTMLAnchorElement && element.querySelector(":scope img") !== null;
}

function userCardFrom(element: HTMLElement): HTMLElement | null {
  return element.closest<HTMLElement>(USER_CARD_SELECTOR);
}

function isProfileLink(link: HTMLAnchorElement, handle: string): boolean {
  const normalizedHandle = handle.toLowerCase();
  try {
    const url = new URL(link.getAttribute("href") ?? "", "https://x.com");
    const path = url.pathname.toLowerCase();
    return path === `/${normalizedHandle}` || path.startsWith(`/${normalizedHandle}/`);
  } catch {
    return false;
  }
}

function cleanedLabel(text: string): string {
  return text.replace(FORMAT_CHARS, "").normalize("NFKC").trim();
}

function isTimeLike(element: Element): boolean {
  return element.closest("time") !== null || element.querySelector("time") !== null;
}

function handleLabel(handle: string): string {
  return `@${handle.toLowerCase()}`;
}

function isVisibleHandleNode(element: Element, handle: string): boolean {
  if (isTimeLike(element) || isAvatarIdentity(element)) return false;
  const label = cleanedLabel(element.textContent ?? "")
    .replace(/[.\u2026]+$/u, "")
    .toLowerCase();
  return label === handleLabel(handle);
}

function innermostHandleNode(root: HTMLElement, handle: string): HTMLElement | null {
  const matches = [...root.querySelectorAll<HTMLElement>("a[href], span")]
    .filter((element) => isVisibleHandleNode(element, handle));
  return matches.find((element) =>
    !matches.some((other) => other !== element && element.contains(other)),
  ) ?? null;
}

function handlePlacementHost(root: HTMLElement, handle: string): HTMLElement | null {
  const node = innermostHandleNode(root, handle);
  if (!node) return null;
  const link = node.closest<HTMLAnchorElement>("a[href]");
  if (!link || isTimeLike(link) || !root.contains(link) || !isProfileLink(link, handle)) {
    return node;
  }
  const linkLabel = cleanedLabel(link.textContent ?? "")
    .replace(/[.\u2026]+$/u, "")
    .toLowerCase();
  return linkLabel === handleLabel(handle) ? link : node;
}

function displayNamePlacementHost(root: HTMLElement, handle: string): HTMLElement | null {
  const handleHost = handlePlacementHost(root, handle);
  for (const link of root.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    if (isTimeLike(link) || isAvatarIdentity(link) || !isProfileLink(link, handle)) continue;
    if (
      handleHost &&
      (link === handleHost || handleHost.contains(link) || link.contains(handleHost))
    ) continue;
    return link;
  }
  return null;
}

function identityInRoot(root: HTMLElement, handle: string): HTMLElement | null {
  return displayNamePlacementHost(root, handle) ?? handlePlacementHost(root, handle);
}

function tweetPlacement(
  anchor: HTMLElement,
  handle: string,
): { host: HTMLElement; position: "beforebegin" | "afterend" } | null {
  const roots: HTMLElement[] = [anchor];
  const card = userCardFrom(anchor);
  const named = (card ?? anchor).matches(USER_NAME_SELECTOR)
    ? card ?? anchor
    : (card ?? anchor).querySelector<HTMLElement>(USER_NAME_SELECTOR);
  if (named && named !== anchor) roots.push(named);
  if (card && card !== anchor) roots.push(card);
  for (const root of roots) {
    const handleHost = handlePlacementHost(root, handle);
    if (handleHost) return { host: handleHost, position: "beforebegin" };
  }
  for (const root of roots) {
    const display = displayNamePlacementHost(root, handle);
    if (display) return { host: display, position: "afterend" };
  }
  if (!isAvatarIdentity(anchor) && !isTimeLike(anchor)) {
    return { host: anchor, position: "afterend" };
  }
  return null;
}

function badgeIsPlaced(
  badge: HTMLElement,
  host: HTMLElement,
  position: "beforebegin" | "afterend",
): boolean {
  return position === "beforebegin"
    ? badge.nextElementSibling === host
    : host.nextElementSibling === badge;
}

function identityElement(anchor: HTMLElement, handle: string): HTMLElement | null {
  const inAnchor = identityInRoot(anchor, handle);
  if (inAnchor && !isAvatarIdentity(inAnchor)) return inAnchor;
  const card = userCardFrom(anchor);
  if (!card || card === anchor) return inAnchor && !isAvatarIdentity(inAnchor) ? inAnchor : null;
  const name = card.querySelector<HTMLElement>(USER_NAME_SELECTOR);
  if (name) {
    const inName = identityInRoot(name, handle);
    if (inName && !isAvatarIdentity(inName)) return inName;
  }
  const inCard = identityInRoot(card, handle);
  return inCard && !isAvatarIdentity(inCard) ? inCard : null;
}

function userCardAvatar(card: HTMLElement, handle: string): HTMLElement | null {
  const containers = [...card.querySelectorAll<HTMLElement>(AVATAR_IDENTITY_SELECTOR)];
  const matching = containers.find((element) => {
    const link = element.closest("a[href]");
    return link instanceof HTMLAnchorElement ? isProfileLink(link, handle) : true;
  });
  if (matching) return matching.closest("a[href]") ?? matching;
  return [...card.querySelectorAll<HTMLAnchorElement>("a[href]")]
    .find((link) => isProfileLink(link, handle) && isAvatarIdentity(link)) ?? null;
}

function placeUserCardBadge(card: HTMLElement, badge: HTMLElement, handle: string): boolean {
  const avatar = userCardAvatar(card, handle);
  if (!avatar) return false;
  const parent = avatar.parentElement;
  const stackOnParent = parent !== null && parent.querySelector(USER_NAME_SELECTOR) === null;
  const stack = stackOnParent ? parent : avatar;
  stack.classList.add("xro-user-card-avatar-stack");
  if (stackOnParent) avatar.insertAdjacentElement("afterend", badge);
  else avatar.append(badge);
  return true;
}

function userCardBadgeMisplaced(badge: HTMLElement, card: HTMLElement): boolean {
  return badge.closest(".xro-user-card-avatar-stack") === null ||
    badge.closest(USER_NAME_SELECTOR) !== null ||
    !card.contains(badge);
}

function clearUserCardStacks(root: ParentNode): void {
  const stacks = root instanceof HTMLElement && root.classList.contains("xro-user-card-avatar-stack")
    ? [root, ...root.querySelectorAll<HTMLElement>(".xro-user-card-avatar-stack")]
    : [...root.querySelectorAll<HTMLElement>(".xro-user-card-avatar-stack")];
  for (const stack of stacks) stack.classList.remove("xro-user-card-avatar-stack");
}

function markBadgeRow(row: HTMLElement): void {
  row.setAttribute(BADGE_ROW_ATTRIBUTE, "");
  row.classList.add(BADGE_ROW_CLASS);
}

function markTightBadgeRow(parent: HTMLElement | null): void {
  if (!parent) return;
  if (parent.matches(USER_NAME_SELECTOR)) return;
  if (parent.querySelector("time")) return;
  markBadgeRow(parent);
}

function clearBadgeRows(anchor: HTMLElement): void {
  const rows = anchor.matches(`[${BADGE_ROW_ATTRIBUTE}]`)
    ? [anchor, ...anchor.querySelectorAll<HTMLElement>(`[${BADGE_ROW_ATTRIBUTE}]`)]
    : [...anchor.querySelectorAll<HTMLElement>(`[${BADGE_ROW_ATTRIBUTE}]`)];
  for (const row of rows) {
    row.removeAttribute(BADGE_ROW_ATTRIBUTE);
    row.classList.remove(BADGE_ROW_CLASS);
  }
}

function clearIdentityMark(anchor: HTMLElement): void {
  anchor.removeAttribute(IDENTITY_ATTRIBUTE);
  anchor.classList.remove(...IDENTITY_CLASSES);
}

export function setRelationshipBadge(
  anchor: HTMLElement,
  relationship: DisplayRelationship,
  handle: string,
  locale: AppLocale,
  currentRelationship?: RelationshipKind,
): void {
  const card = userCardFrom(anchor);
  const searchRoot = card ?? anchor;
  const existing = searchRoot.querySelector<HTMLElement>(`[${BADGE_ATTRIBUTE}]`);
  const badge = existing ?? document.createElement("span");
  const presentation = relationshipPresentation(locale, relationship);
  const identityRelationship = relationship === "blocked_you" || relationship === "blocked_by"
    ? "blocked_by"
    : relationship === "following_only" ||
        (relationship === "unfollowed_you" && currentRelationship === "following_only")
      ? "following_only"
      : relationship;
  const identity = identityElement(anchor, handle);
  clearIdentityMark(anchor);
  if (card) {
    const name = card.querySelector<HTMLElement>(USER_NAME_SELECTOR);
    if (name) clearIdentityMark(name);
  }
  if (
    !card &&
    (identityRelationship === "following_only" || identityRelationship === "blocked_by")
  ) {
    anchor.setAttribute(IDENTITY_ATTRIBUTE, relationship);
    anchor.classList.add("xro-identity-mark", `xro-identity-mark--${identityRelationship}`);
  }
  badge.setAttribute(BADGE_ATTRIBUTE, relationship);
  badge.className = `xro-badge xro-badge--${relationship}`;
  if (card) badge.classList.add("xro-badge--user-card");
  if (badge.textContent !== presentation.shortLabel) badge.textContent = presentation.shortLabel;
  badge.title = `${handle} · ${presentation.description}`;
  badge.setAttribute("aria-label", `${handle}: ${presentation.label}`);
  const placement = card ? null : tweetPlacement(anchor, handle);
  const misplaced = existing !== null && (
    card
      ? userCardBadgeMisplaced(existing, card)
      : !placement || !badgeIsPlaced(existing, placement.host, placement.position)
  );
  if (card && (!existing || misplaced)) {
    if (existing && misplaced) existing.remove();
    if (!placeUserCardBadge(card, badge, handle) && identity && !isAvatarIdentity(identity)) {
      identity.insertAdjacentElement("afterend", badge);
    } else if (!badge.isConnected && !isAvatarIdentity(anchor)) {
      anchor.append(badge);
    }
  } else if (!card && (!existing || misplaced)) {
    if (existing && misplaced) {
      existing.remove();
      clearBadgeRows(anchor);
    }
    if (placement) {
      placement.host.insertAdjacentElement(placement.position, badge);
      markTightBadgeRow(badge.parentElement);
    } else if (!isAvatarIdentity(anchor)) {
      anchor.append(badge);
    }
  } else if (!card && badge.parentElement) {
    markTightBadgeRow(badge.parentElement);
  }
}

export function removeRelationshipBadges(root: ParentNode = document): void {
  for (const badge of root.querySelectorAll(`[${BADGE_ATTRIBUTE}]`)) badge.remove();
  const marked = root instanceof HTMLElement && root.matches(`[${IDENTITY_ATTRIBUTE}]`)
    ? [root, ...root.querySelectorAll<HTMLElement>(`[${IDENTITY_ATTRIBUTE}]`)]
    : [...root.querySelectorAll<HTMLElement>(`[${IDENTITY_ATTRIBUTE}]`)];
  for (const identity of marked) clearIdentityMark(identity);
  if (root instanceof HTMLElement) clearBadgeRows(root);
  else {
    for (const row of root.querySelectorAll<HTMLElement>(`[${BADGE_ROW_ATTRIBUTE}]`)) {
      row.removeAttribute(BADGE_ROW_ATTRIBUTE);
      row.classList.remove(BADGE_ROW_CLASS);
    }
  }
  clearUserCardStacks(root);
}

export function removeRelationshipBadge(anchor: HTMLElement): void {
  const root = userCardFrom(anchor) ?? anchor;
  for (const badge of root.querySelectorAll(`[${BADGE_ATTRIBUTE}]`)) badge.remove();
  const marked = root.matches(`[${IDENTITY_ATTRIBUTE}]`)
    ? [root, ...root.querySelectorAll<HTMLElement>(`[${IDENTITY_ATTRIBUTE}]`)]
    : [...root.querySelectorAll<HTMLElement>(`[${IDENTITY_ATTRIBUTE}]`)];
  for (const identity of marked) clearIdentityMark(identity);
  clearBadgeRows(root);
  clearUserCardStacks(root);
}

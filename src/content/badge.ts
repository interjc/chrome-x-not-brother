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

function identityInRoot(root: HTMLElement, handle: string): HTMLElement | null {
  const normalizedHandle = handle.toLowerCase();
  const visibleHandle = `@${normalizedHandle}`;
  const handleText = [...root.querySelectorAll<HTMLElement>("span")].find(
    (element) => (element.textContent ?? "").trim().toLowerCase() === visibleHandle,
  );
  const handleLink = handleText?.closest<HTMLAnchorElement>("a[href]") ?? null;
  const profileLinks = [...root.querySelectorAll<HTMLAnchorElement>("a[href]")]
    .filter((link) => isProfileLink(link, handle) && !isAvatarIdentity(link));
  return profileLinks.find((link) => link !== handleLink) ??
    profileLinks[0] ??
    handleLink ??
    handleText ??
    null;
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
  const misplaced = existing !== null && (
    card ? userCardBadgeMisplaced(existing, card) : false
  );
  if (card && (!existing || misplaced)) {
    if (existing && misplaced) existing.remove();
    if (!placeUserCardBadge(card, badge, handle) && identity && !isAvatarIdentity(identity)) {
      identity.insertAdjacentElement("afterend", badge);
    } else if (!badge.isConnected && !isAvatarIdentity(anchor)) {
      anchor.append(badge);
    }
  } else if (!card && !existing) {
    if (identity) {
      identity.insertAdjacentElement("afterend", badge);
      markBadgeRow(badge.parentElement ?? anchor);
    } else {
      anchor.append(badge);
    }
  } else if (!card && badge.parentElement) {
    markBadgeRow(badge.parentElement);
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

import type { DisplayRelationship, RelationshipKind } from "../domain/types";
import { relationshipPresentation, type AppLocale } from "../i18n";
import { USER_NAME_SELECTOR } from "./x-adapter";

const BADGE_ATTRIBUTE = "data-xro-badge";
const BADGE_ROW_ATTRIBUTE = "data-xro-badge-row";
const BADGE_ROW_CLASS = "xro-name-badge-row";
const BADGE_STACK_ATTRIBUTE = "data-xro-badge-stack";
const BADGE_STACK_CLASS = "xro-name-badge-stack";
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

type BadgePosition = "beforebegin" | "afterend" | "beforeend";

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

function namedRoot(from: HTMLElement): HTMLElement | null {
  if (from.matches(USER_NAME_SELECTOR)) return from;
  return from.closest<HTMLElement>(USER_NAME_SELECTOR) ??
    from.querySelector<HTMLElement>(USER_NAME_SELECTOR);
}

function overlayNameCluster(from: HTMLElement, handle: string): HTMLElement | null {
  const named = namedRoot(from);
  if (!named || containsTime(named)) return null;
  const handleHost = handlePlacementHost(named, handle);
  const displayHost = displayNamePlacementHost(named, handle);
  if (!handleHost || !displayHost) return null;
  return named;
}

function tweetPlacement(
  anchor: HTMLElement,
  handle: string,
): { host: HTMLElement; position: BadgePosition } | null {
  const roots: HTMLElement[] = [anchor];
  const card = userCardFrom(anchor);
  const named = (card ?? anchor).matches(USER_NAME_SELECTOR)
    ? card ?? anchor
    : (card ?? anchor).querySelector<HTMLElement>(USER_NAME_SELECTOR);
  if (named && named !== anchor) roots.push(named);
  if (card && card !== anchor) roots.push(card);
  for (const root of roots) {
    const overlay = overlayNameCluster(root, handle);
    if (overlay) return { host: overlay, position: "beforeend" };
  }
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
  position: BadgePosition,
): boolean {
  if (position === "beforebegin") return badge.nextElementSibling === host;
  if (position === "beforeend") {
    return badge.parentElement === host && host.lastElementChild === badge;
  }
  return host.nextElementSibling === badge;
}

function placeBadge(
  host: HTMLElement,
  position: BadgePosition,
  badge: HTMLElement,
): void {
  if (position === "beforeend") host.append(badge);
  else host.insertAdjacentElement(position, badge);
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

function markBadgeStack(stack: HTMLElement): void {
  stack.setAttribute(BADGE_STACK_ATTRIBUTE, "");
  stack.classList.add(BADGE_STACK_CLASS);
}

function containsTime(element: HTMLElement): boolean {
  return element.querySelector("time") !== null;
}

function innermostNameHandleCluster(named: HTMLElement, handle: string): HTMLElement | null {
  const handleHost = handlePlacementHost(named, handle);
  const displayHost = displayNamePlacementHost(named, handle);
  if (!handleHost || !displayHost) return null;
  let current: HTMLElement | null = handleHost.parentElement;
  while (current) {
    if (!named.contains(current) && current !== named) break;
    if (current.contains(displayHost) && !containsTime(current)) return current;
    if (current === named) break;
    current = current.parentElement;
  }
  return named;
}

function markOverlayIdentity(named: HTMLElement, handle: string): void {
  markBadgeStack(named);
  const cluster = innermostNameHandleCluster(named, handle);
  if (cluster && cluster !== named) markBadgeRow(cluster);
}

function markIdentityLayout(parent: HTMLElement | null, handle: string): void {
  if (!parent) return;
  const overlay = overlayNameCluster(parent, handle);
  if (overlay) {
    markOverlayIdentity(overlay, handle);
    return;
  }
  if (parent.matches(USER_NAME_SELECTOR) || containsTime(parent)) return;
  markBadgeRow(parent);
}

function clearMarked(
  root: ParentNode,
  attribute: string,
  className: string,
): void {
  const matches = root instanceof HTMLElement && root.matches(`[${attribute}]`)
    ? [root, ...root.querySelectorAll<HTMLElement>(`[${attribute}]`)]
    : [...root.querySelectorAll<HTMLElement>(`[${attribute}]`)];
  for (const element of matches) {
    element.removeAttribute(attribute);
    element.classList.remove(className);
  }
}

function clearBadgeRows(anchor: ParentNode): void {
  clearMarked(anchor, BADGE_ROW_ATTRIBUTE, BADGE_ROW_CLASS);
  clearMarked(anchor, BADGE_STACK_ATTRIBUTE, BADGE_STACK_CLASS);
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
      placeBadge(placement.host, placement.position, badge);
      markIdentityLayout(badge.parentElement, handle);
    } else if (!isAvatarIdentity(anchor)) {
      anchor.append(badge);
    }
  } else if (!card && badge.parentElement) {
    markIdentityLayout(badge.parentElement, handle);
  }
}

export function removeRelationshipBadges(root: ParentNode = document): void {
  for (const badge of root.querySelectorAll(`[${BADGE_ATTRIBUTE}]`)) badge.remove();
  const marked = root instanceof HTMLElement && root.matches(`[${IDENTITY_ATTRIBUTE}]`)
    ? [root, ...root.querySelectorAll<HTMLElement>(`[${IDENTITY_ATTRIBUTE}]`)]
    : [...root.querySelectorAll<HTMLElement>(`[${IDENTITY_ATTRIBUTE}]`)];
  for (const identity of marked) clearIdentityMark(identity);
  clearBadgeRows(root);
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

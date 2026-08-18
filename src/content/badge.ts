import type { DisplayRelationship } from "../domain/types";
import { relationshipPresentation, type AppLocale } from "../i18n";

const BADGE_ATTRIBUTE = "data-xro-badge";
const IDENTITY_ATTRIBUTE = "data-xro-relationship";
const IDENTITY_CLASSES = [
  "xro-identity-mark",
  "xro-identity-mark--following_only",
  "xro-identity-mark--blocked_by",
];

function handleElement(anchor: HTMLElement, handle: string): HTMLElement | null {
  const normalizedHandle = handle.toLowerCase();
  for (const link of anchor.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    try {
      const url = new URL(link.getAttribute("href") ?? "", "https://x.com");
      if (url.pathname.toLowerCase() === `/${normalizedHandle}`) return link;
    } catch {
      // Ignore malformed host links and fall back to exact visible handle text.
    }
  }
  const visibleHandle = `@${normalizedHandle}`;
  return [...anchor.querySelectorAll<HTMLElement>("span")].find(
    (element) => (element.textContent ?? "").trim().toLowerCase() === visibleHandle,
  ) ?? null;
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
): void {
  const existing = anchor.querySelector<HTMLElement>(`[${BADGE_ATTRIBUTE}]`);
  const badge = existing ?? document.createElement("span");
  const presentation = relationshipPresentation(locale, relationship);
  clearIdentityMark(anchor);
  if (relationship === "following_only" || relationship === "blocked_by") {
    anchor.setAttribute(IDENTITY_ATTRIBUTE, relationship);
    anchor.classList.add("xro-identity-mark", `xro-identity-mark--${relationship}`);
  }
  badge.setAttribute(BADGE_ATTRIBUTE, relationship);
  badge.className = `xro-badge xro-badge--${relationship}`;
  badge.textContent = presentation.shortLabel;
  badge.title = `${handle} · ${presentation.description}`;
  badge.setAttribute("aria-label", `${handle}: ${presentation.label}`);
  if (!existing) {
    const identityHandle = handleElement(anchor, handle);
    if (identityHandle) identityHandle.insertAdjacentElement("afterend", badge);
    else anchor.append(badge);
  }
}

export function removeRelationshipBadges(root: ParentNode = document): void {
  for (const badge of root.querySelectorAll(`[${BADGE_ATTRIBUTE}]`)) badge.remove();
  const marked = root instanceof HTMLElement && root.matches(`[${IDENTITY_ATTRIBUTE}]`)
    ? [root, ...root.querySelectorAll<HTMLElement>(`[${IDENTITY_ATTRIBUTE}]`)]
    : [...root.querySelectorAll<HTMLElement>(`[${IDENTITY_ATTRIBUTE}]`)];
  for (const identity of marked) clearIdentityMark(identity);
}

export function removeRelationshipBadge(anchor: HTMLElement): void {
  for (const badge of anchor.querySelectorAll(`[${BADGE_ATTRIBUTE}]`)) badge.remove();
  clearIdentityMark(anchor);
}

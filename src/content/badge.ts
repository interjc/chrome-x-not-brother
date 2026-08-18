import type { DisplayRelationship } from "../domain/types";
import { relationshipPresentation, type AppLocale } from "../i18n";

const BADGE_ATTRIBUTE = "data-xro-badge";
const BADGE_ROW_ATTRIBUTE = "data-xro-badge-row";
const BADGE_ROW_CLASS = "xro-name-badge-row";
const IDENTITY_ATTRIBUTE = "data-xro-relationship";
const IDENTITY_CLASSES = [
  "xro-identity-mark",
  "xro-identity-mark--following_only",
  "xro-identity-mark--blocked_by",
];

function identityElement(anchor: HTMLElement, handle: string): HTMLElement | null {
  const normalizedHandle = handle.toLowerCase();
  const visibleHandle = `@${normalizedHandle}`;
  const handleText = [...anchor.querySelectorAll<HTMLElement>("span")].find(
    (element) => (element.textContent ?? "").trim().toLowerCase() === visibleHandle,
  );
  const handleLink = handleText?.closest<HTMLAnchorElement>("a[href]") ?? null;
  const profileLinks: HTMLAnchorElement[] = [];
  for (const link of anchor.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    try {
      const url = new URL(link.getAttribute("href") ?? "", "https://x.com");
      const path = url.pathname.toLowerCase();
      if (path === `/${normalizedHandle}` || path.startsWith(`/${normalizedHandle}/`)) {
        profileLinks.push(link);
      }
    } catch {
      // Ignore malformed host links and fall back to exact visible handle text.
    }
  }
  return profileLinks.find((link) => link !== handleLink) ?? profileLinks[0] ?? handleLink ?? handleText ?? null;
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
): void {
  const existing = anchor.querySelector<HTMLElement>(`[${BADGE_ATTRIBUTE}]`);
  const badge = existing ?? document.createElement("span");
  const presentation = relationshipPresentation(locale, relationship);
  const identityRelationship = relationship === "blocked_you"
    ? "blocked_by"
    : relationship === "unfollowed_you"
      ? "following_only"
      : relationship;
  clearIdentityMark(anchor);
  if (identityRelationship === "following_only" || identityRelationship === "blocked_by") {
    anchor.setAttribute(IDENTITY_ATTRIBUTE, relationship);
    anchor.classList.add("xro-identity-mark", `xro-identity-mark--${identityRelationship}`);
  }
  badge.setAttribute(BADGE_ATTRIBUTE, relationship);
  badge.className = `xro-badge xro-badge--${relationship}`;
  if (badge.textContent !== presentation.shortLabel) badge.textContent = presentation.shortLabel;
  badge.title = `${handle} · ${presentation.description}`;
  badge.setAttribute("aria-label", `${handle}: ${presentation.label}`);
  if (!existing) {
    const identity = identityElement(anchor, handle);
    if (identity) {
      identity.insertAdjacentElement("afterend", badge);
      markBadgeRow(badge.parentElement ?? anchor);
    } else {
      anchor.append(badge);
    }
  } else if (badge.parentElement) {
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
}

export function removeRelationshipBadge(anchor: HTMLElement): void {
  for (const badge of anchor.querySelectorAll(`[${BADGE_ATTRIBUTE}]`)) badge.remove();
  clearBadgeRows(anchor);
  clearIdentityMark(anchor);
}

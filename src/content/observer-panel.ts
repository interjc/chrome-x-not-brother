import type { ObservationSummary } from "../domain/types";
import { getDocumentLocale, translate, type AppLocale } from "../i18n";

export type ObserverPanelState = "active" | "paused" | "needs-consent";

export interface ObserverPanelModel {
  state: ObserverPanelState;
  summary: ObservationSummary | null;
  locale: AppLocale;
  collapsed: boolean;
  version?: string;
}

const ROOT_ID = "not-brother-observer-panel";

function element<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  return node;
}

export function renderObserverPanel(
  doc: Document,
  model: ObserverPanelModel,
  onOpen: () => void,
  onCollapsedChange: (collapsed: boolean) => void,
): HTMLElement {
  const existing = doc.getElementById(ROOT_ID);
  const root = existing ?? element(doc, "div");
  const renderKey = JSON.stringify([
    model.state,
    model.summary,
    model.locale,
    model.collapsed,
    model.version,
  ]);
  if (existing?.dataset.xroRenderKey === renderKey) return existing;
  root.id = ROOT_ID;
  root.dataset.xroRenderKey = renderKey;
  root.setAttribute("data-xro-overlay", "");
  if (model.version) root.dataset.xroVersion = model.version;
  else delete root.dataset.xroVersion;
  root.className = [
    "xro-observer-panel",
    `xro-observer-panel--${model.state}`,
    model.collapsed ? "xro-observer-panel--collapsed" : "",
  ].filter(Boolean).join(" ");
  root.dataset.xroCollapsed = String(model.collapsed);
  root.setAttribute("aria-live", "polite");

  if (model.collapsed) {
    const expand = element(doc, "button", "xro-observer-panel__bubble");
    expand.type = "button";
    const expandLabel = translate(model.locale, "dockExpandAria");
    expand.setAttribute("aria-label", expandLabel);
    expand.title = expandLabel;

    const bubbleMark = element(doc, "span", "xro-observer-panel__bubble-mark");
    bubbleMark.textContent = "NB";
    bubbleMark.setAttribute("aria-hidden", "true");
    const bubbleDot = element(doc, "i", "xro-observer-panel__dot");
    bubbleDot.setAttribute("aria-hidden", "true");
    expand.append(bubbleMark, bubbleDot);
    expand.addEventListener("click", () => onCollapsedChange(false));
    root.replaceChildren(expand);

    if (!existing) doc.documentElement.append(root);
    return root;
  }

  const top = element(doc, "div", "xro-observer-panel__top");
  const mark = element(doc, "span", "xro-observer-panel__mark");
  mark.textContent = "NB";
  mark.setAttribute("aria-hidden", "true");

  const identity = element(doc, "div", "xro-observer-panel__identity");
  const status = element(doc, "strong");
  const note = element(doc, "span");
  if (model.state === "active") {
    status.textContent = translate(model.locale, "observing");
    note.textContent = translate(
      model.locale,
      model.summary?.total === 0 ? "dockHoverHint" : "dockVisibleEvidence",
    );
  } else if (model.state === "paused") {
    status.textContent = translate(model.locale, "dockPausedStatus");
    note.textContent = translate(model.locale, "dockPausedNote");
  } else {
    status.textContent = translate(model.locale, "dockNeedsConsentStatus");
    note.textContent = translate(model.locale, "dockNeedsConsentNote");
  }
  identity.append(status, note);

  const stateDot = element(doc, "i", "xro-observer-panel__dot");
  stateDot.setAttribute("aria-hidden", "true");
  const collapse = element(doc, "button", "xro-observer-panel__collapse");
  collapse.type = "button";
  collapse.textContent = "×";
  const collapseLabel = translate(model.locale, "dockCollapseAria");
  collapse.setAttribute("aria-label", collapseLabel);
  collapse.title = collapseLabel;
  collapse.addEventListener("click", () => onCollapsedChange(true));
  top.append(mark, identity, stateDot, collapse);
  root.replaceChildren(top);

  if (model.state === "active") {
    const summary = model.summary;
    const stats = element(doc, "dl", "xro-observer-panel__stats");
    const items = [
      [translate(model.locale, "dockStatObserved"), summary?.total],
      [translate(model.locale, "dockStatFollowingOnly"), summary?.followingOnly],
      [translate(model.locale, "dockStatBlockedBy"), summary?.blockedBy],
      [translate(model.locale, "dockStatChanged"), summary?.changed],
    ] as const;
    for (const [label, value] of items) {
      const item = element(doc, "div");
      const term = element(doc, "dt");
      const detail = element(doc, "dd");
      term.textContent = label;
      detail.textContent = value === undefined ? "—" : String(value);
      item.append(term, detail);
      stats.append(item);
    }
    root.append(stats);
  }

  const button = element(doc, "button", "xro-observer-panel__action");
  button.type = "button";
  button.textContent = translate(
    model.locale,
    model.state === "active" ? "dockViewDetails" : "dockOpenSidePanel",
  );
  button.setAttribute(
    "aria-label",
    translate(
      model.locale,
      model.state === "active" ? "dockViewDetailsAria" : "dockStartAria",
    ),
  );
  button.addEventListener("click", onOpen);
  root.append(button);

  if (!existing) doc.documentElement.append(root);
  return root;
}

export function showObserverPanelOpenHint(
  doc: Document,
  locale: AppLocale = getDocumentLocale(doc),
): void {
  const button = doc.querySelector<HTMLButtonElement>(
    `#${ROOT_ID} .xro-observer-panel__action`,
  );
  if (button) button.textContent = translate(locale, "dockToolbarHint");
}

export function removeObserverPanel(doc: Document): void {
  doc.getElementById(ROOT_ID)?.remove();
}

import type { ObservationSummary } from "../domain/types";
import { getDocumentLocale, translate, type AppLocale } from "../i18n";
import { X_CORNER_FAB_SELECTOR } from "./x-adapter";

export type ObserverPanelState = "active" | "paused" | "needs-consent";

export interface ObserverPanelFilterRules {
  applying: boolean;
  ruleCount: number;
  activeRuleCount: number;
  pageHiddenByRules: number;
  lifetimeHiddenByRules: number;
}

export interface ObserverPanelModel {
  state: ObserverPanelState;
  summary: ObservationSummary | null;
  locale: AppLocale;
  collapsed: boolean;
  version?: string;
  filterRules?: ObserverPanelFilterRules | null;
}

const ROOT_ID = "not-brother-observer-panel";
const CORNER_FAB_SHIFT_STYLE_CLASS = "xro-observer-panel__corner-fab-shift";
const CORNER_FAB_SHIFT = "72px";

function cornerFabShiftStyle(doc: Document): HTMLStyleElement {
  const style = doc.createElement("style");
  style.className = CORNER_FAB_SHIFT_STYLE_CLASS;
  style.textContent =
    `${X_CORNER_FAB_SELECTOR}{translate:0 -${CORNER_FAB_SHIFT}}`;
  return style;
}

function element<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  return node;
}

function svgIcon(doc: Document, paths: string[], className?: string): SVGSVGElement {
  const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  if (className) svg.setAttribute("class", className);
  for (const d of paths) {
    const path = doc.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

export function renderObserverPanel(
  doc: Document,
  model: ObserverPanelModel,
  onOpen: () => void,
  onCollapsedChange: (collapsed: boolean) => void,
  onOpenFilterRules?: () => void,
): HTMLElement {
  const existing = doc.getElementById(ROOT_ID);
  const root = existing ?? element(doc, "div");
  const renderKey = JSON.stringify([
    model.state,
    model.summary,
    model.locale,
    model.collapsed,
    model.version,
    model.filterRules,
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
    const launcher = element(doc, "div", "xro-observer-panel__launcher");
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
    if (model.state === "needs-consent") {
      const consent = element(doc, "button", "xro-observer-panel__consent-action");
      consent.type = "button";
      consent.textContent = translate(model.locale, "dockReviewConsent");
      consent.setAttribute("aria-label", translate(model.locale, "dockReviewConsentAria"));
      consent.addEventListener("click", onOpen);
      launcher.append(consent, expand);
    } else {
      launcher.append(expand);
    }
    root.replaceChildren(launcher, cornerFabShiftStyle(doc));

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

  if (model.state !== "needs-consent" && model.filterRules) {
    const filters = element(doc, "div", "xro-observer-panel__filters");
    if (model.filterRules.applying) {
      filters.dataset.xroFilterApplying = "true";
    }
    const copy = element(doc, "div", "xro-observer-panel__filters-copy");
    const title = element(doc, "strong");
    title.textContent = `${translate(model.locale, "dockFilterRulesLabel")} · ${translate(
      model.locale,
      "dockFilterRulesCounts",
      {
        active: model.filterRules.applying ? model.filterRules.activeRuleCount : 0,
        total: model.filterRules.ruleCount,
      },
    )}`;
    const hidden = element(doc, "span");
    hidden.className = "xro-observer-panel__filters-hidden";
    hidden.textContent = translate(model.locale, "dockFilterRulesHidden", {
      page: model.filterRules.pageHiddenByRules,
      total: model.filterRules.lifetimeHiddenByRules,
    });
    copy.append(title, hidden);
    filters.append(copy);
    if (onOpenFilterRules) {
      const edit = element(doc, "button", "xro-observer-panel__filters-edit");
      edit.type = "button";
      const editLabel = translate(model.locale, "dockFilterRulesEditAria");
      edit.setAttribute("aria-label", editLabel);
      edit.title = editLabel;
      edit.append(svgIcon(doc, [
        "M12 20h9",
        "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z",
      ]));
      edit.addEventListener("click", onOpenFilterRules);
      filters.append(edit);
    }
    root.append(filters);
  }

  const button = element(doc, "button", "xro-observer-panel__action");
  button.type = "button";
  const actionLabel = element(doc, "span", "xro-observer-panel__action-label");
  actionLabel.textContent = translate(
    model.locale,
    model.state === "active"
      ? "dockViewDetails"
      : model.state === "needs-consent" ? "dockReviewConsent" : "dockOpenSidePanel",
  );
  button.append(
    actionLabel,
    svgIcon(doc, ["M4 6h16v12H4z", "M10 6v12"], "xro-observer-panel__action-icon"),
  );
  button.setAttribute(
    "aria-label",
    translate(
      model.locale,
      model.state === "active"
        ? "dockViewDetailsAria"
        : model.state === "needs-consent" ? "dockReviewConsentAria" : "dockStartAria",
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
  const label = doc.querySelector<HTMLElement>(
    `#${ROOT_ID} .xro-observer-panel__action-label`,
  );
  if (label) label.textContent = translate(locale, "dockToolbarHint");
}

export function removeObserverPanel(doc: Document): void {
  doc.getElementById(ROOT_ID)?.remove();
}

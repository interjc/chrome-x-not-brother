import { translate, type AppLocale } from "../i18n";
import {
  HOVER_CARD_SELECTOR,
  handleFromHoverCard,
  hoverCardQuickRuleAnchor,
  openTweetMoreMenu,
  tweetTextRootFrom,
  visibleHoverCards,
} from "./x-adapter";

export const QUICK_RULE_ATTRIBUTE = "data-xro-quick-rule";
const KEYWORD_CHIP_ID = "not-brother-keyword-chip";
const TOAST_ID = "not-brother-quick-rule-toast";

export interface QuickRuleActionState {
  locale: AppLocale;
  viewerHandle: string | null;
  enabled: boolean;
  blockedHandles: Set<string>;
  onAddHandle: (handle: string) => void;
  onAddKeyword: (value: string) => void;
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

function stopEvent(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
}

function setText(node: Element | null, value: string): void {
  if (node && node.textContent !== value) node.textContent = value;
}

function setAttr(node: Element, name: string, value: string): void {
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}

function appendHandleChrome(root: HTMLElement, markText: string): void {
  const mark = element(root.ownerDocument, "span", "xro-quick-rule__mark");
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = markText;
  const label = element(root.ownerDocument, "span", "xro-quick-rule__label");
  root.append(mark, label);
}

function createHoverButton(doc: Document): HTMLButtonElement {
  const button = element(doc, "button", "xro-quick-rule xro-quick-rule--handle");
  button.type = "button";
  button.setAttribute(QUICK_RULE_ATTRIBUTE, "handle");
  appendHandleChrome(button, "!");
  button.addEventListener("mousedown", stopEvent);
  button.addEventListener("pointerdown", stopEvent);
  return button;
}

function createMenuItem(doc: Document): HTMLElement {
  const item = element(doc, "div", "xro-quick-rule xro-quick-rule--menu");
  item.setAttribute("role", "menuitem");
  item.tabIndex = 0;
  item.setAttribute(QUICK_RULE_ATTRIBUTE, "menu");
  appendHandleChrome(item, "!");
  item.addEventListener("mousedown", stopEvent);
  item.addEventListener("pointerdown", stopEvent);
  return item;
}

function paintHandleAction(
  node: HTMLElement,
  locale: AppLocale,
  handle: string,
  blocked: boolean,
  onAddHandle: (handle: string) => void,
): void {
  setText(
    node.querySelector(".xro-quick-rule__label"),
    translate(locale, blocked ? "quickRuleHandleAdded" : "quickRuleHandle"),
  );
  const added = blocked ? "true" : "false";
  if (node.dataset.xroAdded !== added) node.dataset.xroAdded = added;
  setAttr(
    node,
    "aria-label",
    translate(
      locale,
      blocked ? "quickRuleHandleAddedAria" : "quickRuleHandleAria",
      { handle },
    ),
  );
  const activate = (event: Event): void => {
    stopEvent(event);
    if (blocked) return;
    onAddHandle(handle);
  };
  node.onclick = activate;
  if (node.getAttribute("role") === "menuitem") {
    node.onkeydown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      activate(event);
    };
  }
}

function placeHoverHandleButton(card: HTMLElement, button: HTMLButtonElement): void {
  const anchor = hoverCardQuickRuleAnchor(card);
  if (anchor === card) {
    if (button.parentElement !== card) card.append(button);
    return;
  }
  if (button.previousElementSibling !== anchor || button.parentNode !== anchor.parentNode) {
    anchor.after(button);
  }
}

export function refreshHoverQuickRules(
  doc: Document,
  state: QuickRuleActionState,
): void {
  if (!state.enabled) {
    for (const button of doc.querySelectorAll(`[${QUICK_RULE_ATTRIBUTE}="handle"]`)) {
      button.remove();
    }
    return;
  }
  const viewer = state.viewerHandle?.toLowerCase() ?? null;
  const seen = new Set<HTMLElement>();
  for (const [userKey, card] of visibleHoverCards(doc)) {
    const handle = handleFromHoverCard(card) ?? userKey;
    if (viewer && handle.toLowerCase() === viewer) continue;
    seen.add(card);
    let button = card.querySelector<HTMLButtonElement>(`[${QUICK_RULE_ATTRIBUTE}="handle"]`);
    if (!button) button = createHoverButton(doc);
    placeHoverHandleButton(card, button);
    paintHandleAction(
      button,
      state.locale,
      handle,
      state.blockedHandles.has(userKey),
      state.onAddHandle,
    );
  }
  for (const button of doc.querySelectorAll(`[${QUICK_RULE_ATTRIBUTE}="handle"]`)) {
    const card = button.closest<HTMLElement>(HOVER_CARD_SELECTOR);
    if (!card || seen.has(card)) continue;
    button.remove();
  }
}

export function refreshTweetMenuQuickRules(
  doc: Document,
  state: QuickRuleActionState,
): void {
  if (!state.enabled) {
    for (const item of doc.querySelectorAll(`[${QUICK_RULE_ATTRIBUTE}="menu"]`)) {
      item.remove();
    }
    return;
  }
  const context = openTweetMoreMenu(doc);
  const viewer = state.viewerHandle?.toLowerCase() ?? null;
  const items = [...doc.querySelectorAll<HTMLElement>(`[${QUICK_RULE_ATTRIBUTE}="menu"]`)];
  if (!context || (viewer && context.handle.toLowerCase() === viewer)) {
    for (const item of items) item.remove();
    return;
  }
  let item = items.find((node) => context.menu.contains(node)) ?? null;
  if (!item) {
    item = createMenuItem(doc);
    context.menu.prepend(item);
  } else if (context.menu.firstElementChild !== item) {
    context.menu.prepend(item);
  }
  for (const extra of items) {
    if (extra !== item) extra.remove();
  }
  paintHandleAction(
    item,
    state.locale,
    context.handle,
    state.blockedHandles.has(context.handle.toLowerCase()),
    state.onAddHandle,
  );
}

function selectionInTweetText(doc: Document): { text: string; rect: DOMRect } | null {
  const selection = doc.defaultView?.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (range.commonAncestorContainer instanceof Element
    ? range.commonAncestorContainer.closest(`[${QUICK_RULE_ATTRIBUTE}]`)
    : range.commonAncestorContainer.parentElement?.closest(`[${QUICK_RULE_ATTRIBUTE}]`)
  ) return null;
  if (!tweetTextRootFrom(range.commonAncestorContainer)) return null;
  const text = selection.toString().normalize("NFKC").trim();
  if (!text) return null;
  const rect = typeof range.getBoundingClientRect === "function"
    ? range.getBoundingClientRect()
    : new DOMRect(8, 8, 1, 1);
  if (rect.width < 1 && rect.height < 1) return null;
  return { text, rect };
}

export function hideKeywordQuickRule(doc: Document): void {
  doc.getElementById(KEYWORD_CHIP_ID)?.remove();
}

export function refreshKeywordQuickRule(
  doc: Document,
  state: Pick<QuickRuleActionState, "locale" | "enabled" | "onAddKeyword">,
): void {
  if (!state.enabled) {
    hideKeywordQuickRule(doc);
    return;
  }
  const selection = selectionInTweetText(doc);
  if (!selection) {
    hideKeywordQuickRule(doc);
    return;
  }
  let chip = doc.getElementById(KEYWORD_CHIP_ID) as HTMLButtonElement | null;
  if (!chip) {
    chip = element(doc, "button", "xro-quick-rule xro-quick-rule--keyword");
    chip.id = KEYWORD_CHIP_ID;
    chip.type = "button";
    chip.setAttribute(QUICK_RULE_ATTRIBUTE, "keyword");
    const mark = element(doc, "span", "xro-quick-rule__mark");
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = "#";
    const label = element(doc, "span", "xro-quick-rule__label");
    chip.append(mark, label);
    chip.addEventListener("mousedown", stopEvent);
    chip.addEventListener("pointerdown", stopEvent);
    doc.documentElement.append(chip);
  }
  const label = chip.querySelector(".xro-quick-rule__label");
  if (label) label.textContent = translate(state.locale, "quickRuleKeyword");
  chip.setAttribute("aria-label", translate(state.locale, "quickRuleKeywordAria"));
  chip.dataset.xroKeyword = selection.text;
  const view = doc.defaultView;
  const top = Math.min((view?.innerHeight ?? 800) - 52, selection.rect.bottom + 8);
  const left = Math.min(
    (view?.innerWidth ?? 800) - 168,
    Math.max(8, selection.rect.left),
  );
  chip.style.top = `${Math.max(8, top)}px`;
  chip.style.left = `${Math.max(8, left)}px`;
  chip.onclick = (event) => {
    stopEvent(event);
    state.onAddKeyword(selection.text);
    hideKeywordQuickRule(doc);
  };
}

export function showQuickRuleToast(doc: Document, message: string): void {
  doc.getElementById(TOAST_ID)?.remove();
  const toast = element(doc, "div", "xro-quick-rule-toast");
  toast.id = TOAST_ID;
  toast.setAttribute("data-xro-overlay", "");
  toast.setAttribute(QUICK_RULE_ATTRIBUTE, "toast");
  toast.setAttribute("role", "status");
  toast.textContent = message;
  doc.documentElement.append(toast);
  const view = doc.defaultView;
  view?.setTimeout(() => {
    if (toast.isConnected) toast.remove();
  }, 2600);
}

export function removeQuickRuleActions(root: ParentNode = document): void {
  if (root instanceof Document) {
    hideKeywordQuickRule(root);
    root.getElementById(TOAST_ID)?.remove();
  }
  for (const node of root.querySelectorAll(`[${QUICK_RULE_ATTRIBUTE}]`)) {
    node.remove();
  }
}

export function createQuickRuleSelectionWatcher(
  doc: Document,
  state: () => Pick<QuickRuleActionState, "locale" | "enabled" | "onAddKeyword">,
): { refresh(): void; stop(): void } {
  let timer = 0;
  const refresh = (): void => {
    refreshKeywordQuickRule(doc, state());
  };
  const schedule = (): void => {
    doc.defaultView?.clearTimeout(timer);
    timer = doc.defaultView?.setTimeout(refresh, 80) ?? 0;
  };
  doc.addEventListener("selectionchange", schedule);
  doc.defaultView?.addEventListener("scroll", schedule, true);
  return {
    refresh,
    stop(): void {
      doc.removeEventListener("selectionchange", schedule);
      doc.defaultView?.removeEventListener("scroll", schedule, true);
      doc.defaultView?.clearTimeout(timer);
      hideKeywordQuickRule(doc);
    },
  };
}

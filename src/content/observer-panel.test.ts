import { afterEach, describe, expect, it, vi } from "vitest";
import { removeObserverPanel, renderObserverPanel } from "./observer-panel";

afterEach(() => removeObserverPanel(document));

describe("observer panel", () => {
  it("renders an active overview and opens details from a real button", () => {
    const onOpen = vi.fn();
    const panel = renderObserverPanel(document, {
      state: "active",
      summary: { total: 12, followingOnly: 3, blockedBy: 2, changed: 1 },
      locale: "zh-CN",
      collapsed: false,
      version: "0.4.7",
    }, onOpen, () => undefined);

    expect(panel.textContent).toContain("观察中");
    expect(panel.textContent).toContain("12");
    expect(panel.dataset.xroVersion).toBe("0.4.7");
    expect(panel.querySelector(".xro-observer-panel__action svg")).toBeTruthy();
    panel.querySelector<HTMLButtonElement>(".xro-observer-panel__action")?.click();
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("reuses one root while switching to consent guidance", () => {
    const onOpen = vi.fn();
    renderObserverPanel(document, { state: "active", summary: null, locale: "en", collapsed: false }, () => undefined, () => undefined);
    renderObserverPanel(document, { state: "needs-consent", summary: null, locale: "ja", collapsed: false }, onOpen, () => undefined);

    expect(document.querySelectorAll("[data-xro-overlay]")).toHaveLength(1);
    expect(document.querySelector("[data-xro-overlay]")?.textContent).toContain("まだ有効ではありません");
    const consent = document.querySelector<HTMLButtonElement>(
      ".xro-observer-panel__action",
    );
    expect(consent?.textContent).toContain("確認して同意");
    consent?.click();
    expect(onOpen).toHaveBeenCalledOnce();
    expect(document.querySelector("[data-xro-overlay]")?.textContent).not.toContain("Observed");
  });

  it("guides an empty active observer toward visible hover-card evidence", () => {
    const panel = renderObserverPanel(
      document,
      {
        state: "active",
        summary: { total: 0, followingOnly: 0, blockedBy: 0, changed: 0 },
        locale: "zh-CN",
        collapsed: false,
      },
      () => undefined,
      () => undefined,
    );

    expect(panel.textContent).toContain("悬停作者");
  });

  it("removes the dock when its extension context is no longer usable", () => {
    renderObserverPanel(document, { state: "active", summary: null, locale: "en", collapsed: false }, () => undefined, () => undefined);

    removeObserverPanel(document);

    expect(document.querySelector("[data-xro-overlay]")).toBeNull();
  });

  it("collapses with the close control and restores from the NB floating button", () => {
    const onCollapsedChange = vi.fn();
    const model = {
      state: "active" as const,
      summary: { total: 12, followingOnly: 3, blockedBy: 2, changed: 1 },
      locale: "zh-CN" as const,
      collapsed: false,
    };
    const panel = renderObserverPanel(
      document,
      model,
      () => undefined,
      onCollapsedChange,
    );

    panel.querySelector<HTMLButtonElement>(".xro-observer-panel__collapse")?.click();
    expect(onCollapsedChange).toHaveBeenLastCalledWith(true);

    renderObserverPanel(
      document,
      { ...model, collapsed: true },
      () => undefined,
      onCollapsedChange,
    );
    const bubble = panel.querySelector<HTMLButtonElement>(".xro-observer-panel__bubble");
    expect(panel.dataset.xroCollapsed).toBe("true");
    expect(bubble?.textContent).toBe("NB");
    expect(bubble?.getAttribute("aria-label")).toContain("展开");

    bubble?.click();
    expect(onCollapsedChange).toHaveBeenLastCalledWith(false);
  });

  it("keeps the NB ball in the page corner and shifts X chat/Grok drawers up", () => {
    const grok = document.createElement("div");
    grok.setAttribute("data-testid", "GrokDrawer");
    const chat = document.createElement("div");
    chat.setAttribute("data-testid", "DMDrawer");
    document.body.append(grok, chat);

    const collapsed = renderObserverPanel(document, {
      state: "active",
      summary: null,
      locale: "en",
      collapsed: true,
    }, () => undefined, () => undefined);

    const shift = collapsed.querySelector("style.xro-observer-panel__corner-fab-shift");
    expect(shift?.textContent).toContain("GrokDrawer");
    expect(shift?.textContent).toContain("DMDrawer");
    expect(shift?.textContent).toContain("chat-drawer-root");
    expect(shift?.textContent).toContain("translate:0 -72px");
    expect(collapsed.classList.contains("xro-observer-panel--collapsed")).toBe(true);

    renderObserverPanel(document, {
      state: "active",
      summary: null,
      locale: "en",
      collapsed: false,
    }, () => undefined, () => undefined);
    expect(document.querySelector("style.xro-observer-panel__corner-fab-shift")).toBeNull();

    removeObserverPanel(document);
    grok.remove();
    chat.remove();
  });

  it("keeps a prominent consent entry next to the collapsed floating button", () => {
    const onOpen = vi.fn();
    const onCollapsedChange = vi.fn();
    const panel = renderObserverPanel(document, {
      state: "needs-consent",
      summary: null,
      locale: "zh-CN",
      collapsed: true,
    }, onOpen, onCollapsedChange);

    const consent = panel.querySelector<HTMLButtonElement>(
      ".xro-observer-panel__consent-action",
    );
    const bubble = panel.querySelector<HTMLButtonElement>(".xro-observer-panel__bubble");
    expect(consent?.textContent).toContain("同意");
    expect(consent?.getAttribute("aria-label")).toContain("隐私说明");

    consent?.click();
    bubble?.click();
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onCollapsedChange).toHaveBeenCalledWith(false);
  });

  it("shows custom blacklist status and opens the editor from the expanded dock", () => {
    const onOpenFilterRules = vi.fn();
    const panel = renderObserverPanel(document, {
      state: "active",
      summary: { total: 4, followingOnly: 1, blockedBy: 0, changed: 0 },
      locale: "zh-CN",
      collapsed: false,
      filterRules: {
        applying: true,
        ruleCount: 5,
        activeRuleCount: 3,
        pageHiddenByRules: 7,
        lifetimeHiddenByRules: 21,
      },
    }, () => undefined, () => undefined, onOpenFilterRules);

    const filters = panel.querySelector<HTMLElement>(".xro-observer-panel__filters");
    expect(filters?.dataset.xroFilterApplying).toBe("true");
    expect(filters?.textContent).toContain("拦截规则 · 生效 3 条/总 5 条");
    expect(filters?.textContent).toContain("本页拦截 7");
    expect(filters?.textContent).toContain("累计 21");
    expect(filters?.querySelectorAll(".xro-observer-panel__filters-copy > *")).toHaveLength(2);
    const edit = panel.querySelector<HTMLButtonElement>(".xro-observer-panel__filters-edit");
    expect(edit?.textContent).toBe("");
    expect(edit?.querySelector("svg")).toBeTruthy();
    edit?.click();
    expect(onOpenFilterRules).toHaveBeenCalledOnce();
  });

  it("keeps filter-rule status on a paused dock and hides it before consent", () => {
    const paused = renderObserverPanel(document, {
      state: "paused",
      summary: null,
      locale: "en",
      collapsed: false,
      filterRules: {
        applying: false,
        ruleCount: 2,
        activeRuleCount: 0,
        pageHiddenByRules: 0,
        lifetimeHiddenByRules: 4,
      },
    }, () => undefined, () => undefined, () => undefined);
    expect(paused.textContent).toContain("Filter rules · 0 active / 2 total");
    expect(paused.textContent).toContain("This page 0");
    expect(paused.textContent).toContain("Total 4");

    renderObserverPanel(document, {
      state: "needs-consent",
      summary: null,
      locale: "zh-CN",
      collapsed: false,
      filterRules: {
        applying: false,
        ruleCount: 2,
        activeRuleCount: 0,
        pageHiddenByRules: 0,
        lifetimeHiddenByRules: 4,
      },
    }, () => undefined, () => undefined, () => undefined);
    expect(document.querySelector(".xro-observer-panel__filters")).toBeNull();
  });

  it("does not show blacklist controls on the collapsed floating button", () => {
    renderObserverPanel(document, {
      state: "active",
      summary: null,
      locale: "zh-CN",
      collapsed: true,
      filterRules: {
        applying: true,
        ruleCount: 4,
        activeRuleCount: 4,
        pageHiddenByRules: 1,
        lifetimeHiddenByRules: 9,
      },
    }, () => undefined, () => undefined, () => undefined);
    expect(document.querySelector(".xro-observer-panel__filters")).toBeNull();
  });
});

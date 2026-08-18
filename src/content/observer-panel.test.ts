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
    }, onOpen, () => undefined);

    expect(panel.textContent).toContain("观察中");
    expect(panel.textContent).toContain("12");
    panel.querySelector<HTMLButtonElement>(".xro-observer-panel__action")?.click();
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("reuses one root while switching to consent guidance", () => {
    renderObserverPanel(document, { state: "active", summary: null, locale: "en", collapsed: false }, () => undefined, () => undefined);
    renderObserverPanel(document, { state: "needs-consent", summary: null, locale: "ja", collapsed: false }, () => undefined, () => undefined);

    expect(document.querySelectorAll("[data-xro-overlay]")).toHaveLength(1);
    expect(document.querySelector("[data-xro-overlay]")?.textContent).toContain("まだ有効ではありません");
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
});

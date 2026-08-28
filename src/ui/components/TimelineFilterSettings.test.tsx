import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../storage/settings";
import { TimelineFilterSettings } from "./TimelineFilterSettings";

describe("TimelineFilterSettings", () => {
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById("root")!);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  });

  it("places the rules editor entry beside the custom blacklist switch", async () => {
    const onEditFilterRules = vi.fn();
    await act(async () => {
      root.render(
        <TimelineFilterSettings
          detailed
          disabled
          locale="zh-CN"
          onChange={vi.fn()}
          onEditFilterRules={onEditFilterRules}
          settings={DEFAULT_SETTINGS}
        />,
      );
    });

    const button = document.querySelector<HTMLButtonElement>(
      ".timeline-filters__edit-rules",
    );
    const item = button?.closest(".timeline-filters__item");
    expect(item?.textContent).toContain("应用自定义拦截规则");
    expect(button?.textContent).toContain("编辑规则与查看教程");
    expect(item?.querySelector("input")?.disabled).toBe(true);
    expect(button?.disabled).toBe(false);

    await act(async () => button?.click());
    expect(onEditFilterRules).toHaveBeenCalledOnce();
  });
});

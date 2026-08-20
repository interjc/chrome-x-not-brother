import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageSwitch } from "./LanguageSwitch";

describe("LanguageSwitch", () => {
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    document.body.innerHTML = '<div id="root"></div>';
  });

  it("selects follow-browser by default and reports a chosen language", async () => {
    const onChange = vi.fn();
    const root = createRoot(document.getElementById("root")!);
    await act(async () => {
      root.render(
        <LanguageSwitch locale="en" value="auto" onChange={onChange} />,
      );
    });

    const select = document.querySelector("select");
    expect(select?.value).toBe("auto");
    expect(select?.textContent).toContain("Match browser language");
    expect(select?.textContent).toContain("English");
    expect(select?.textContent).toContain("日本語");
    expect(select?.textContent).toContain("简体中文");

    await act(async () => {
      select!.value = "zh-CN";
      select!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith("zh-CN");
    await act(async () => root.unmount());
  });
});

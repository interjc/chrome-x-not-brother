import { describe, expect, it } from "vitest";
import {
  getDocumentLocale,
  normalizeLocale,
  relationshipPresentation,
  sourceTypeLabel,
  translate,
} from ".";

describe("runtime internationalization", () => {
  it("normalizes supported language families and falls back to English", () => {
    expect(normalizeLocale("zh-TW")).toBe("zh-CN");
    expect(normalizeLocale("ja-JP")).toBe("ja");
    expect(normalizeLocale("en-GB")).toBe("en");
    expect(normalizeLocale("fr-FR")).toBe("en");
  });

  it("uses the X document language ahead of the extension UI locale", () => {
    document.documentElement.lang = "ja-JP";
    expect(getDocumentLocale(document)).toBe("ja");
  });

  it("substitutes values and localizes domain presentation", () => {
    expect(translate("en", "changedCount", { count: 3 })).toBe("3 relationships changed");
    expect(relationshipPresentation("ja", "blocked_by").shortLabel).toBe("ブロック");
    expect(sourceTypeLabel("zh-CN", "thread")).toBe("评论区");
  });

  it("uses the localized product name in each supported language", () => {
    expect(translate("zh-CN", "brandName")).toBe("不是兄弟");
    expect(translate("en", "brandName")).toBe("Not Brother");
    expect(translate("ja", "brandName")).toBe("兄貴じゃない");
  });

  it("localizes the observer dock collapse controls", () => {
    expect(translate("zh-CN", "dockCollapseAria")).toContain("悬浮球");
    expect(translate("en", "dockExpandAria")).toContain("Expand");
    expect(translate("ja", "dockCollapseAria")).toContain("フローティング");
  });

  it("localizes the reply-thread hover guidance", () => {
    expect(translate("zh-CN", "dockHoverHint")).toContain("悬停");
    expect(translate("en", "dockHoverHint")).toContain("Hover");
    expect(translate("ja", "dockHoverHint")).toContain("カーソル");
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  getDocumentLocale,
  normalizeLocale,
  resolveUiLocale,
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

  it("resolves a stored UI language preference, defaulting to the browser", () => {
    expect(resolveUiLocale("ja")).toBe("ja");
    expect(resolveUiLocale("zh-CN")).toBe("zh-CN");
    expect(resolveUiLocale("en")).toBe("en");
    vi.stubGlobal("chrome", { i18n: { getUILanguage: () => "ja-JP" } });
    expect(resolveUiLocale("auto")).toBe("ja");
    expect(resolveUiLocale(undefined)).toBe("ja");
    vi.unstubAllGlobals();
  });

  it("substitutes values and localizes domain presentation", () => {
    expect(translate("en", "changedCount", { count: 3 })).toBe("3 relationships changed");
    expect(relationshipPresentation("ja", "blocked_by").shortLabel).toBe("ブロック");
    expect(relationshipPresentation("zh-CN", "mutual").shortLabel).toBe("互关");
    expect(relationshipPresentation("zh-CN", "unfollowed_you").shortLabel).toBe("对方取关");
    expect(relationshipPresentation("zh-CN", "you_unfollowed").shortLabel).toBe("你已取关");
    expect(relationshipPresentation("zh-CN", "blocked_you").shortLabel).toBe("对方拉黑");
    expect(relationshipPresentation("zh-CN", "blocked_you").label).toBe("对方把我拉黑");
    expect(relationshipPresentation("en", "unfollowed_you").label).toBe("They unfollowed");
    expect(relationshipPresentation("ja", "blocked_you").label).toContain("ブロック");
    for (const kind of [
      "unfollowed_you",
      "you_unfollowed",
      "blocked_you",
    ] as const) {
      expect([...relationshipPresentation("zh-CN", kind).shortLabel]).toHaveLength(4);
    }
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

  it("localizes the extension language switcher", () => {
    expect(translate("zh-CN", "languageFollowBrowser")).toContain("浏览器");
    expect(translate("en", "languageFollowBrowser")).toContain("browser");
    expect(translate("ja", "languageFollowBrowser")).toContain("ブラウザー");
    expect(translate("en", "languageEnglish")).toBe("English");
    expect(translate("ja", "languageJapanese")).toBe("日本語");
    expect(translate("zh-CN", "languageChinese")).toBe("简体中文");
  });

  it("localizes the GitHub Issues feedback link", () => {
    expect(translate("zh-CN", "sendFeedback")).toBe("发送反馈");
    expect(translate("en", "sendFeedbackAria")).toContain("GitHub Issues");
    expect(translate("ja", "sendFeedback")).toContain("フィードバック");
  });

  it("localizes the reply-thread hover guidance", () => {
    expect(translate("zh-CN", "dockHoverHint")).toContain("悬停");
    expect(translate("en", "dockHoverHint")).toContain("Hover");
    expect(translate("ja", "dockHoverHint")).toContain("カーソル");
  });
});

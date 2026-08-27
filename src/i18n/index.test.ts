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
    expect(resolveUiLocale("auto", "en")).toBe("en");
    expect(resolveUiLocale("zh-CN", "en")).toBe("zh-CN");
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
    expect(translate("zh-CN", "dockReviewConsent")).toContain("同意");
    expect(translate("en", "dockExpandAria")).toContain("Expand");
    expect(translate("en", "actionConsentMenu")).toContain("privacy notice");
    expect(translate("ja", "dockCollapseAria")).toContain("フローティング");
    expect(translate("ja", "dockReviewConsentAria")).toContain("プライバシー");
    expect(translate("zh-CN", "quickRuleHandle")).toContain("不是兄弟");
    expect(translate("zh-CN", "quickRuleKeyword")).toContain("关键词");
    expect(translate("en", "quickRuleHandle")).toContain("Not Brother");
    expect(translate("ja", "quickRuleKeyword")).toContain("キーワード");
    expect(translate("zh-CN", "dockFilterRulesLabel")).toContain("黑名单");
    expect(translate("zh-CN", "dockFilterRulesApplying", { count: 3 })).toContain("3");
    expect(translate("en", "dockFilterRulesEdit")).toContain("Edit");
    expect(translate("ja", "dockFilterRulesIdle", { count: 2 })).toContain("未適用");
  });

  it("localizes the extension language switcher", () => {
    expect(translate("zh-CN", "languageFollowBrowser")).toContain("浏览器");
    expect(translate("en", "languageFollowBrowser")).toContain("browser");
    expect(translate("ja", "languageFollowBrowser")).toContain("ブラウザー");
    expect(translate("en", "languageEnglish")).toBe("English");
    expect(translate("ja", "languageJapanese")).toBe("日本語");
    expect(translate("zh-CN", "languageChinese")).toBe("简体中文");
  });

  it("localizes side panel status and options tabs", () => {
    expect(translate("zh-CN", "sideTabStatus")).toBe("状态");
    expect(translate("en", "sideTabOptions")).toBe("Options");
    expect(translate("ja", "sideTabOptions")).toBe("オプション");
  });

  it("localizes optional timeline filter settings", () => {
    expect(translate("zh-CN", "hideMutedAccountsLabel")).toContain("静音");
    expect(translate("en", "hideMutedAccountsLabel")).toContain("muted");
    expect(translate("ja", "hideMutedAccountsLabel")).toContain("ミュート");
    expect(translate("zh-CN", "hideBlockedByAccountsLabel")).toContain("拉黑");
    expect(translate("en", "hideBlockedByAccountsDescription")).toContain("not a complete list");
    expect(translate("zh-CN", "hideByFilterRulesLabel")).toContain("黑名单");
    expect(translate("zh-CN", "editFilterRules")).toContain("教程");
    expect(translate("zh-CN", "filterRulesExampleLoaded")).toContain("示例");
    expect(translate("zh-CN", "filterRulesNamespace", { handle: "alice" })).toContain("@alice");
    expect(translate("en", "filterRulesUseExampleUrl")).toContain("example URL");
    expect(translate("zh-CN", "filterRulesImportAppend")).toContain("追加");
    expect(translate("zh-CN", "filterRulesUnsavedLeave")).toContain("尚未保存");
    expect(translate("en", "filterRulesUnsavedHint")).toContain("Unsaved");
    expect(translate("en", "filterRulesImportReplace")).toContain("replace");
    expect(translate("en", "filterRulesRemotePrivacy")).toContain("Chrome asks");
    expect(translate("en", "filterRulesGuideRegexBody")).toContain("Unicode");
    expect(translate("ja", "filterRulesTypeContent")).toContain("投稿内容");
    expect(translate("ja", "filterRulesGuideHeading")).toContain("ガイド");
    expect(translate("ja", "optionsIntro")).toContain("オフ");
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

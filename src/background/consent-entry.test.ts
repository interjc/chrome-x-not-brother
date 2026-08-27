import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CURRENT_CONSENT_VERSION, DEFAULT_SETTINGS } from "../storage/settings";
import {
  CONSENT_CONTEXT_MENU_ID,
  consentContextMenuPresentation,
  syncConsentContextMenu,
} from "./consent-entry";

describe("consent entry", () => {
  const create = vi.fn((
    _properties: chrome.contextMenus.CreateProperties,
    callback?: () => void,
  ) => {
    callback?.();
    return CONSENT_CONTEXT_MENU_ID;
  });
  const update = vi.fn(async () => undefined);

  beforeEach(() => {
    create.mockClear();
    update.mockReset();
    update.mockResolvedValue(undefined);
    vi.stubGlobal("chrome", {
      contextMenus: { create, update },
      i18n: { getUILanguage: () => "en-US" },
      runtime: { lastError: undefined },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("shows a localized action-menu entry only before current consent", () => {
    expect(consentContextMenuPresentation(DEFAULT_SETTINGS, "zh-CN")).toEqual({
      title: "查看隐私说明并同意…",
      visible: true,
    });
    expect(consentContextMenuPresentation({
      ...DEFAULT_SETTINGS,
      consentVersion: CURRENT_CONSENT_VERSION,
    }, "en").visible).toBe(false);
  });

  it("updates an existing menu and creates it when missing", async () => {
    await syncConsentContextMenu(DEFAULT_SETTINGS);
    expect(update).toHaveBeenCalledWith(CONSENT_CONTEXT_MENU_ID, {
      title: "Review privacy notice and agree…",
      visible: true,
    });
    expect(create).not.toHaveBeenCalled();

    update.mockRejectedValueOnce(new Error("Cannot find menu item"));
    await syncConsentContextMenu(DEFAULT_SETTINGS);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      id: CONSENT_CONTEXT_MENU_ID,
      contexts: ["action"],
      visible: true,
    }), expect.any(Function));
  });
});

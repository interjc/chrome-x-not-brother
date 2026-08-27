import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bundledDefaultFilterRuleSet,
  DEFAULT_FILTER_RULES_URL,
} from "../../domain/filter-rules-default";
import { createEmptyFilterRuleSet, FilterRuleSetSchema } from "../../domain/filter-rules";
import { FILTER_RULES_KEY, filterRulesStorageKey } from "../../storage/filter-rules";
import { FilterRulesManager } from "./FilterRulesManager";

describe("FilterRulesManager", () => {
  let root: Root;
  let stored: Record<string, unknown>;
  const listeners = new Set<(
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ) => void>();
  const permissionRequest = vi.fn(async () => true);

  beforeEach(() => {
    window.location.hash = "";
    stored = {};
    listeners.clear();
    permissionRequest.mockClear();
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async () => ({ ...stored })),
          set: vi.fn(async (items: Record<string, unknown>) => {
            for (const [key, value] of Object.entries(items)) {
              const oldValue = stored[key];
              stored[key] = value;
              for (const listener of listeners) {
                listener({ [key]: { oldValue, newValue: value } }, "local");
              }
            }
          }),
          remove: vi.fn(async (keys: string | string[]) => {
            for (const key of Array.isArray(keys) ? keys : [keys]) {
              const oldValue = stored[key];
              delete stored[key];
              for (const listener of listeners) {
                listener({ [key]: { oldValue, newValue: undefined } }, "local");
              }
            }
          }),
        },
        onChanged: {
          addListener: (listener: typeof listeners extends Set<infer Listener> ? Listener : never) =>
            listeners.add(listener),
          removeListener: (listener: typeof listeners extends Set<infer Listener> ? Listener : never) =>
            listeners.delete(listener),
        },
      },
      permissions: { request: permissionRequest },
    });
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById("root")!);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  });

  it("edits, validates, saves, and enables local handle rules", async () => {
    stored[FILTER_RULES_KEY] = createEmptyFilterRuleSet();
    const onEnabledChange = vi.fn();
    await act(async () => {
      root.render(
        <FilterRulesManager
          locale="en"
          enabled={false}
          disabled={false}
          onEnabledChange={onEnabledChange}
        />,
      );
    });

    const add = [...document.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent === "Add rule")!;
    await act(async () => add.click());

    const handles = document.querySelector<HTMLTextAreaElement>(".filter-rule-card textarea")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set?.call(handles, "@Alice, BOB");
      handles.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const save = [...document.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent === "Save rules")!;
    await act(async () => save.click());

    expect(stored[FILTER_RULES_KEY]).toMatchObject({
      format: "not-brother-filter-rules",
      schemaVersion: 1,
      rules: [{ type: "user_handles", handles: ["alice", "bob"] }],
    });
    expect(document.querySelector("[role='status']")?.textContent)
      .toContain("Rules saved");

    const master = document.querySelector<HTMLInputElement>(
      ".filter-rules-manager__master input",
    )!;
    await act(async () => master.click());
    expect(onEnabledChange).toHaveBeenCalledWith(true);
  });

  it("makes unsaved edits obvious and warns before leaving the page", async () => {
    stored[FILTER_RULES_KEY] = createEmptyFilterRuleSet();
    await act(async () => {
      root.render(
        <FilterRulesManager
          locale="zh-CN"
          enabled={false}
          disabled={false}
          standalone
          onEnabledChange={() => undefined}
        />,
      );
    });

    const findSave = (): HTMLButtonElement =>
      [...document.querySelectorAll<HTMLButtonElement>("button")]
        .find((button) => button.textContent === "保存规则")!;
    expect(findSave().classList.contains("primary-button")).toBe(true);
    expect(findSave().disabled).toBe(true);
    expect(document.querySelector("[data-filter-rules-dirty]")).toBeNull();

    const add = document.querySelector<HTMLButtonElement>(".filter-rules-editor__compose .filter-rules-editor__add")!;
    expect(add.textContent).toBe("添加规则");
    expect(add.closest(".filter-rules-editor__compose")?.querySelector("select")).toBeTruthy();
    await act(async () => add.click());

    expect(document.querySelector("[data-filter-rules-dirty]")).toBeTruthy();
    expect(document.querySelector(".filter-rules-editor.is-dirty")).toBeTruthy();
    expect(document.querySelector(".filter-rules-editor__unsaved")?.textContent)
      .toContain("未保存");
    expect(findSave().disabled).toBe(false);

    const leaving = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(leaving);
    expect(leaving.defaultPrevented).toBe(true);

    const handles = document.querySelector<HTMLTextAreaElement>(".filter-rule-card textarea")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")
        ?.set?.call(handles, "alice");
      handles.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => findSave().click());
    expect(document.querySelector("[data-filter-rules-dirty]")).toBeNull();
    const afterSave = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(afterSave);
    expect(afterSave.defaultPrevented).toBe(false);
  });

  it("opens and focuses the editor from its deep link and keeps the authoring guide collapsed", async () => {
    stored[FILTER_RULES_KEY] = createEmptyFilterRuleSet();
    window.location.hash = "#filter-rules";
    await act(async () => {
      root.render(
        <FilterRulesManager
          locale="en"
          enabled={false}
          disabled={false}
          onEnabledChange={vi.fn()}
        />,
      );
    });

    const manager = document.querySelector<HTMLDetailsElement>("#filter-rules");
    const guide = document.querySelector<HTMLDetailsElement>(".filter-rules-guide");
    expect(manager?.open).toBe(true);
    expect(document.activeElement).toBe(manager?.querySelector(":scope > summary"));
    expect(guide?.open).toBe(false);
    expect(guide?.querySelector("summary")?.textContent).toContain("Rule authoring guide");

    await act(async () => {
      guide?.querySelector("summary")?.click();
    });
    expect(guide?.open).toBe(true);
    expect(guide?.textContent).toContain("Safe regular expressions");
    expect(guide?.textContent).toContain("Imports, Gists, and overwrite");

    const example = guide?.querySelector(".filter-rules-guide__json code")?.textContent;
    const parsedExample = JSON.parse(example ?? "") as unknown;
    expect(parsedExample).toMatchObject({
      format: "not-brother-filter-rules",
      schemaVersion: 1,
      rules: bundledDefaultFilterRuleSet.rules,
    });
    expect(FilterRuleSetSchema.safeParse(parsedExample).success).toBe(true);
    expect(document.querySelector<HTMLInputElement>("#filter-rules-url")?.value)
      .toBe(DEFAULT_FILTER_RULES_URL);
  });

  it("loads the bundled default rules when the user has no local blacklist", async () => {
    await act(async () => {
      root.render(
        <FilterRulesManager
          locale="zh-CN"
          enabled={false}
          disabled={false}
          onEnabledChange={vi.fn()}
        />,
      );
    });

    expect(stored[FILTER_RULES_KEY]).toMatchObject({
      format: "not-brother-filter-rules",
      rules: bundledDefaultFilterRuleSet.rules,
    });
    expect(document.querySelector("[role='status']")?.textContent).toContain("默认示例");
    expect(document.querySelector<HTMLInputElement>(
      ".filter-rule-card input[maxLength='120']",
    )?.value).toBe("福");
  });

  it("keeps separate rule documents for different signed-in handles", async () => {
    stored[filterRulesStorageKey("alice")] = {
      ...createEmptyFilterRuleSet(),
      name: "Alice rules",
      rules: [{
        id: "alice-rule",
        label: "Alice only",
        enabled: true,
        expiresAt: null,
        type: "content",
        match: { mode: "contains", value: "alice", caseSensitive: false },
      }],
    };
    stored[filterRulesStorageKey("bob")] = {
      ...createEmptyFilterRuleSet(),
      name: "Bob rules",
      rules: [{
        id: "bob-rule",
        label: "Bob only",
        enabled: true,
        expiresAt: null,
        type: "content",
        match: { mode: "contains", value: "bob", caseSensitive: false },
      }],
    };

    await act(async () => {
      root.render(
        <FilterRulesManager
          locale="en"
          enabled={false}
          disabled={false}
          viewerHandle="Alice"
          onEnabledChange={vi.fn()}
        />,
      );
    });
    expect(document.querySelector(".filter-rules-manager__namespace")?.textContent)
      .toContain("@Alice");
    expect(document.querySelector<HTMLInputElement>(
      ".filter-rule-card input[maxLength='120']",
    )?.value).toBe("Alice only");

    await act(async () => {
      root.render(
        <FilterRulesManager
          locale="en"
          enabled={false}
          disabled={false}
          viewerHandle="bob"
          onEnabledChange={vi.fn()}
        />,
      );
    });
    expect(document.querySelector(".filter-rules-manager__namespace")?.textContent)
      .toContain("@bob");
    expect(document.querySelector<HTMLInputElement>(
      ".filter-rule-card input[maxLength='120']",
    )?.value).toBe("Bob only");
  });

  it("asks whether to update by id or replace before importing a file", async () => {
    stored[FILTER_RULES_KEY] = createEmptyFilterRuleSet();
    await act(async () => {
      root.render(
        <FilterRulesManager
          locale="zh-CN"
          enabled={false}
          disabled={false}
          onEnabledChange={vi.fn()}
        />,
      );
    });

    const upload = [...document.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent === "上传 JSON 文件")!;
    await act(async () => upload.click());

    const dialog = document.querySelector("[role='dialog']");
    expect(dialog?.textContent).toContain("按 ID 更新");
    expect(dialog?.textContent).toContain("清空后覆盖");
    expect(dialog?.querySelectorAll("button")).toHaveLength(3);
  });
});

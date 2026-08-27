import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FilterRuleSetSchema } from "../../domain/filter-rules";
import { FILTER_RULES_KEY } from "../../storage/filter-rules";
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

  it("opens and focuses the editor from its deep link and shows the authoring guide", async () => {
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
    expect(manager?.open).toBe(true);
    expect(document.activeElement).toBe(manager?.querySelector("summary"));
    expect(manager?.textContent).toContain("Rule authoring guide");
    expect(manager?.textContent).toContain("Safe regular expressions");
    expect(manager?.textContent).toContain("Imports, Gists, and merging");

    const example = manager?.querySelector(".filter-rules-guide__json code")?.textContent;
    const parsedExample = JSON.parse(example ?? "") as unknown;
    expect(parsedExample).toMatchObject({
      format: "not-brother-filter-rules",
      schemaVersion: 1,
      rules: [{ id: "hide-giveaways", type: "content" }],
    });
    expect(FilterRuleSetSchema.safeParse(parsedExample).success).toBe(true);
  });
});

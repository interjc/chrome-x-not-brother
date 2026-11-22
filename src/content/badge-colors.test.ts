import { describe, expect, it } from "vitest";

// Vitest serves CSS imports empty, so read the stylesheet from disk. The
// project has no Node typings, hence the loosely typed dynamic import.
const fs = (await import("node:fs" as string)) as {
  readFileSync(path: string, encoding: "utf8"): string;
};
const css = fs.readFileSync("public/content-script.css", "utf8");
const SCALE = ["mutual", "follows_you_only", "following_only", "blocked_by"] as const;

function rulesFor(state: string, dark: boolean): string[] {
  const prefix = dark ? ':root\\[data-xro-theme="dark"\\] ' : "^";
  const pattern = new RegExp(`${prefix}\\.xro-badge--${state}\\s*([,{])([^}]*)`, "gm");
  return [...css.matchAll(pattern)].map((match) => `${match[1]}${match[2]}`);
}

describe("badge color scale", () => {
  it.each([false, true])("gives every state its own badge color (dark: %s)", (dark) => {
    const backgrounds = SCALE.map((state) => {
      const rules = rulesFor(state, dark);
      expect(rules.length, state).toBeGreaterThan(0);
      // A shared selector list would hand one state another state's color.
      for (const rule of rules) expect(rule.startsWith("{"), state).toBe(true);
      return /background:\s*(#[0-9a-f]{6})/i.exec(rules.join(""))?.[1];
    });
    expect(new Set(backgrounds).size).toBe(SCALE.length);
  });
});

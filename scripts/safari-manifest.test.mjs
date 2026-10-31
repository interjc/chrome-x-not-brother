import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SAFARI_MIN_VERSION, SAFARI_POPUP, toSafariManifest } from "./safari-manifest.mjs";

const chromeManifest = JSON.parse(readFileSync("public/manifest.json", "utf8"));

describe("toSafariManifest", () => {
  const safari = toSafariManifest(chromeManifest);

  it("replaces the side panel with the toolbar popup", () => {
    expect(safari.side_panel).toBeUndefined();
    expect(safari.permissions).not.toContain("sidePanel");
    expect(safari.action.default_popup).toBe(SAFARI_POPUP);
    expect(safari.action.default_title).toBe(chromeManifest.action.default_title);
  });

  it("swaps the Chrome version floor for a Safari one", () => {
    expect(safari.minimum_chrome_version).toBeUndefined();
    expect(safari.browser_specific_settings.safari.strict_min_version).toBe(SAFARI_MIN_VERSION);
  });

  it("keeps the shared extension surface unchanged", () => {
    for (const key of [
      "manifest_version",
      "name",
      "version",
      "default_locale",
      "content_scripts",
      "background",
      "options_ui",
      "optional_host_permissions",
      "icons",
    ]) {
      expect(safari[key]).toEqual(chromeManifest[key]);
    }
    expect(safari.permissions).toEqual(
      chromeManifest.permissions.filter((permission) => permission !== "sidePanel"),
    );
  });

  it("does not mutate the Chrome manifest", () => {
    expect(chromeManifest.side_panel).toBeDefined();
    expect(chromeManifest.action.default_popup).toBeUndefined();
  });
});

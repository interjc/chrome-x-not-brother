import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../storage/settings";
import { actionPresentation } from "./action-state";

describe("toolbar action presentation", () => {
  it("shows an onboarding alert before consent", () => {
    expect(actionPresentation(DEFAULT_SETTINGS, "en")).toMatchObject({
      badgeText: "!",
      badgeColor: "#E9A83A",
    });
  });

  it("shows ON only while the consented observer is active", () => {
    expect(actionPresentation({
      ...DEFAULT_SETTINGS,
      consentVersion: 1,
      observerEnabled: true,
    }, "en")).toMatchObject({
      badgeText: "ON",
      badgeColor: "#C9ED67",
    });
  });

  it("distinguishes a user-paused observer from first-run setup", () => {
    const result = actionPresentation({
      ...DEFAULT_SETTINGS,
      consentVersion: 1,
      observerEnabled: false,
    }, "ja");
    expect(result.badgeText).toBe("!");
    expect(result.badgeColor).toBe("#8A938D");
    expect(result.title).toContain("一時停止");
  });
});

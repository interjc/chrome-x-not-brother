import { afterEach, describe, expect, it } from "vitest";
import {
  isTrackedSidePanelOpen,
  rememberSidePanelClosed,
  rememberSidePanelOpen,
} from "./side-panel-visibility";

afterEach(() => {
  rememberSidePanelClosed(1);
  rememberSidePanelClosed(2);
});

describe("side panel visibility tracking", () => {
  it("tracks open windows and ignores missing ids", () => {
    rememberSidePanelOpen(undefined);
    expect(isTrackedSidePanelOpen(undefined)).toBe(false);
    rememberSidePanelOpen(1);
    expect(isTrackedSidePanelOpen(1)).toBe(true);
    expect(isTrackedSidePanelOpen(2)).toBe(false);
    rememberSidePanelClosed(1);
    expect(isTrackedSidePanelOpen(1)).toBe(false);
  });
});

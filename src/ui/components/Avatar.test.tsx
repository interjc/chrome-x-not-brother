import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Avatar } from "./Avatar";

describe("Avatar", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("loads a handle-based avatar even when the stored URL is missing", () => {
    act(() => {
      root.render(<Avatar avatarUrl={null} displayName="Tibo" handle="thsottiaux" />);
    });
    const image = container.querySelector("img");
    expect(image?.getAttribute("src")).toBe("https://unavatar.io/x/thsottiaux");
    expect(container.querySelector(".avatar--fallback")).toBeNull();
  });

  it("falls back to a stored X CDN URL if the handle avatar fails", () => {
    const stored = "https://pbs.twimg.com/profile_images/1/tibo_x96.jpg";
    act(() => {
      root.render(<Avatar avatarUrl={stored} displayName="Tibo" handle="thsottiaux" />);
    });
    const image = container.querySelector("img");
    act(() => {
      image?.dispatchEvent(new Event("error"));
    });
    expect(container.querySelector("img")?.getAttribute("src")).toBe(stored);
  });

  it("shows the initial when both avatar sources fail", () => {
    act(() => {
      root.render(<Avatar avatarUrl={null} displayName="Tibo" handle="thsottiaux" />);
    });
    act(() => {
      container.querySelector("img")?.dispatchEvent(new Event("error"));
    });
    expect(container.querySelector(".avatar--fallback")?.textContent).toBe("T");
  });
});

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

  it("uses the most recently observed X CDN URL first", () => {
    const observed = "https://pbs.twimg.com/profile_images/1/tibo_normal.jpg";
    act(() => {
      root.render(<Avatar avatarUrl={observed} handle="thsottiaux" />);
    });
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://pbs.twimg.com/profile_images/1/tibo_x96.jpg",
    );
  });

  it("uses the handle service when no observed URL is available", () => {
    act(() => {
      root.render(<Avatar avatarUrl={null} handle="thsottiaux" />);
    });
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://unavatar.io/x/thsottiaux",
    );
  });

  it("falls back from the observed URL to the handle service, then the initial", () => {
    act(() => {
      root.render(
        <Avatar
          avatarUrl="https://pbs.twimg.com/profile_images/1/tibo_x96.jpg"
          handle="thsottiaux"
        />,
      );
    });
    act(() => {
      container.querySelector("img")?.dispatchEvent(new Event("error"));
    });
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://unavatar.io/x/thsottiaux",
    );
    act(() => {
      container.querySelector("img")?.dispatchEvent(new Event("error"));
    });
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".avatar--fallback")?.textContent).toBe("T");
  });

  it("uses a newly observed URL after an older observed URL failed", () => {
    const first = "https://pbs.twimg.com/profile_images/1/tibo_x96.jpg";
    const second = "https://pbs.twimg.com/profile_images/2/tibo-new_x96.jpg";
    act(() => {
      root.render(<Avatar avatarUrl={first} handle="thsottiaux" />);
    });
    act(() => {
      container.querySelector("img")?.dispatchEvent(new Event("error"));
    });
    act(() => {
      root.render(<Avatar avatarUrl={second} handle="thsottiaux" />);
    });
    expect(container.querySelector("img")?.getAttribute("src")).toBe(second);
  });
});

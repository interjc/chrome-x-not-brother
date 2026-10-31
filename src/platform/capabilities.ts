// Feature detection for browser APIs that not every extension host ships.
// Safari has no side panel and no badge text color; callers check here
// instead of sniffing the browser, so a host that adds an API later simply
// takes the Chrome path.

export function hasSidePanel(): boolean {
  return typeof globalThis.chrome?.sidePanel?.open === "function";
}

export async function setBadgeTextColor(color: string): Promise<void> {
  if (typeof chrome.action.setBadgeTextColor !== "function") return;
  await chrome.action.setBadgeTextColor({ color });
}

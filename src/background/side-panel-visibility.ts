const openWindows = new Set<number>();

export function rememberSidePanelOpen(windowId: number | undefined): void {
  if (windowId !== undefined) openWindows.add(windowId);
}

export function rememberSidePanelClosed(windowId: number | undefined): void {
  if (windowId !== undefined) openWindows.delete(windowId);
}

export function isTrackedSidePanelOpen(windowId: number | undefined): boolean {
  return windowId !== undefined && openWindows.has(windowId);
}

export async function hydrateTrackedSidePanels(): Promise<void> {
  if (!chrome.runtime.getContexts) return;
  try {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: [chrome.runtime.ContextType.SIDE_PANEL],
    });
    openWindows.clear();
    for (const context of contexts) rememberSidePanelOpen(context.windowId);
  } catch {
    // A later open/close event or click can recover the tracked set.
  }
}

export function watchSidePanelVisibility(): void {
  chrome.sidePanel.onOpened?.addListener?.((info) => {
    rememberSidePanelOpen(info.windowId);
  });
  chrome.sidePanel.onClosed?.addListener?.((info) => {
    rememberSidePanelClosed(info.windowId);
  });
}

export async function closeExtensionSidePanel(tab: chrome.tabs.Tab): Promise<void> {
  if (typeof chrome.sidePanel.close === "function" && tab.windowId !== undefined) {
    await chrome.sidePanel.close({ windowId: tab.windowId });
    return;
  }
  await chrome.sidePanel.setOptions({ enabled: false });
  await chrome.sidePanel.setOptions({ enabled: true });
}

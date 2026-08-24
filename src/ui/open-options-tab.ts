import { updateSettings } from "../storage/settings";

export async function openSidePanelOptionsTab(): Promise<boolean> {
  const persist = updateSettings({ sidePanelTab: "options" });
  try {
    await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
    await persist;
    return true;
  } catch {
    await persist.catch(() => undefined);
    return false;
  }
}

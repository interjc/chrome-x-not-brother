import type { DataChangedMessage } from "../domain/messages";

interface TabsMessageApi {
  query(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]>;
  sendMessage(tabId: number, message: DataChangedMessage): Promise<unknown>;
}

const DATA_CHANGED_MESSAGE: DataChangedMessage = { type: "data:changed" };

export async function broadcastDataChanged(tabsApi: TabsMessageApi): Promise<void> {
  const tabs = await tabsApi.query({});
  await Promise.all(tabs.map(async (tab) => {
    if (tab.id === undefined) return;
    try {
      await tabsApi.sendMessage(tab.id, DATA_CHANGED_MESSAGE);
    } catch {
      // Most tabs do not host the statically declared x.com content script.
    }
  }));
}

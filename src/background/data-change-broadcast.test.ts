import { describe, expect, it, vi } from "vitest";
import { broadcastDataChanged } from "./data-change-broadcast";

describe("data change broadcast", () => {
  it("notifies every tab with an id and ignores tabs without a content script", async () => {
    const query = vi.fn().mockResolvedValue([
      { id: 11 },
      { id: 12 },
      {},
    ]);
    const sendMessage = vi.fn(async (tabId: number) => {
      if (tabId === 12) throw new Error("No receiver");
    });

    await expect(broadcastDataChanged({ query, sendMessage })).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledWith({});
    expect(sendMessage).toHaveBeenNthCalledWith(1, 11, { type: "data:changed" });
    expect(sendMessage).toHaveBeenNthCalledWith(2, 12, { type: "data:changed" });
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });
});

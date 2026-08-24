import {
  harvestUsersFromPayload,
  isPageStoreQueryMessage,
  mergePageUserMaps,
  PAGE_STORE_MESSAGE_SOURCE,
  readPageUserRelationships,
  type PageStoreResultMessage,
  type PageStoreUpdatedMessage,
  type PageUserRelationship,
} from "./page-store";

const HOOK_FLAG = "__notBrotherHarvestedGraphql";
const harvested = new Map<string, PageUserRelationship>();
const UPDATE_NOTIFY_MS = 32;
let notifyTimer = 0;

function publishUsers(requestId: string): void {
  const users = Object.fromEntries(
    mergePageUserMaps(harvested, readPageUserRelationships(document)),
  );
  const message: PageStoreResultMessage = {
    source: PAGE_STORE_MESSAGE_SOURCE,
    type: "result",
    requestId,
    users,
  };
  window.postMessage(message, window.location.origin);
}

function graphqlHref(input: unknown): string | null {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  if (input && typeof input === "object" && "url" in input) {
    const url = (input as Request).url;
    return typeof url === "string" ? url : null;
  }
  return null;
}

function isGraphqlUrl(url: string | null): boolean {
  return Boolean(url && url.includes("/i/api/graphql/"));
}

function ingestGraphqlBody(body: unknown): void {
  harvestUsersFromPayload(body, harvested);
  scheduleHideSignal();
}

function scheduleHideSignal(): void {
  if (notifyTimer) return;
  notifyTimer = window.setTimeout(() => {
    notifyTimer = 0;
    const users: Record<string, PageUserRelationship> = {};
    for (const [key, user] of harvested) {
      if (user.muting === true || user.blockedBy === true) users[key] = user;
    }
    if (Object.keys(users).length === 0) return;
    const message: PageStoreUpdatedMessage = {
      source: PAGE_STORE_MESSAGE_SOURCE,
      type: "updated",
      users,
    };
    window.postMessage(message, window.location.origin);
  }, UPDATE_NOTIFY_MS);
}

function hookNetwork(): void {
  const flagged = window as Window & { [HOOK_FLAG]?: boolean };
  if (flagged[HOOK_FLAG]) return;
  flagged[HOOK_FLAG] = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
    const response = await originalFetch(...args);
    try {
      if (isGraphqlUrl(graphqlHref(args[0])) && response.ok) {
        void response.clone().json().then(ingestGraphqlBody).catch(() => undefined);
      }
    } catch {
      // Harvest is best-effort and must not break X's own requests.
    }
    return response;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null,
  ): void {
    const href = typeof url === "string" ? url : url.href;
    if (isGraphqlUrl(href)) {
      this.addEventListener("load", () => {
        if (this.status < 200 || this.status >= 300) return;
        try {
          ingestGraphqlBody(JSON.parse(this.responseText) as unknown);
        } catch {
          // Ignore non-JSON GraphQL responses.
        }
      });
    }
    originalOpen.call(this, method, url, async ?? true, username, password);
  };
}

hookNetwork();

window.addEventListener("message", (event: MessageEvent) => {
  if (event.source !== window) return;
  if (!isPageStoreQueryMessage(event.data)) return;
  try {
    publishUsers(event.data.requestId);
  } catch {
    const message: PageStoreResultMessage = {
      source: PAGE_STORE_MESSAGE_SOURCE,
      type: "result",
      requestId: event.data.requestId,
      users: {},
    };
    window.postMessage(message, window.location.origin);
  }
});

import {
  isUsableDisplayName,
  normalizeProfileImageUrl,
} from "../domain/identity";
import {
  isCollectableRelationship,
  resolveRelationship,
} from "../domain/relationships";
import type { ObservationDraft } from "../domain/types";
import type { ExtractedCandidate } from "./x-adapter";

export const PAGE_STORE_MESSAGE_SOURCE = "not-brother-page-store";
export const PAGE_STORE_BRIDGE_TIMEOUT_MS = 350;

export interface PageUserRelationship {
  handle: string;
  following: boolean | null;
  followsYou: boolean | null;
  blockedBy: boolean | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface PageStoreQueryMessage {
  source: typeof PAGE_STORE_MESSAGE_SOURCE;
  type: "query";
  requestId: string;
}

export interface PageStoreResultMessage {
  source: typeof PAGE_STORE_MESSAGE_SOURCE;
  type: "result";
  requestId: string;
  users: Record<string, PageUserRelationship>;
}

const HANDLE_PATTERN = /^@?([A-Za-z0-9_]{1,15})$/;
const FORMAT_CHARS = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;
const RESERVED_PATHS = new Set([
  "home",
  "explore",
  "notifications",
  "messages",
  "i",
  "settings",
  "compose",
  "search",
  "jobs",
  "communities",
  "tos",
  "privacy",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function booleanField(...values: unknown[]): boolean | null {
  for (const value of values) {
    if (typeof value === "boolean") return value;
  }
  return null;
}

function stringField(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function normalizeHandle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(FORMAT_CHARS, "").normalize("NFKC").trim();
  const match = trimmed.match(HANDLE_PATTERN);
  if (!match?.[1]) return null;
  return RESERVED_PATHS.has(match[1].toLowerCase()) ? null : match[1];
}

function completeness(user: PageUserRelationship): number {
  return Number(user.following !== null) +
    Number(user.followsYou !== null) +
    Number(user.blockedBy !== null);
}

function pageUserFromUnknown(value: unknown): PageUserRelationship | null {
  if (!isRecord(value)) return null;
  const legacy = isRecord(value.legacy) ? value.legacy : {};
  const perspectives = isRecord(value.relationship_perspectives)
    ? value.relationship_perspectives
    : {};
  const handle = normalizeHandle(
    value.screen_name ??
      value.screenName ??
      legacy.screen_name ??
      value.username,
  );
  if (!handle) return null;
  const following = booleanField(
    value.following,
    legacy.following,
    perspectives.following,
  );
  const followsYou = booleanField(
    value.followed_by,
    legacy.followed_by,
    perspectives.followed_by,
  );
  const blockedBy = booleanField(
    value.blocked_by,
    legacy.blocked_by,
    perspectives.blocked_by,
  );
  if (following === null && followsYou === null && blockedBy === null) return null;
  const displayName = stringField(value.name, legacy.name);
  const avatarUrl = normalizeProfileImageUrl(
    stringField(
      value.profile_image_url_https,
      legacy.profile_image_url_https,
      value.profile_image_url,
      legacy.profile_image_url,
    ),
  );
  return {
    handle,
    following,
    followsYou,
    blockedBy,
    displayName: displayName && isUsableDisplayName(displayName, handle) ? displayName : null,
    avatarUrl,
  };
}

function rememberUser(
  users: Map<string, PageUserRelationship>,
  user: PageUserRelationship | null,
): void {
  if (!user) return;
  const key = user.handle.toLowerCase();
  const existing = users.get(key);
  if (!existing || completeness(user) > completeness(existing)) users.set(key, user);
}

function usersFromBag(bag: unknown, users: Map<string, PageUserRelationship>): void {
  if (!bag) return;
  const values = bag instanceof Map
    ? [...bag.values()]
    : isRecord(bag) ? Object.values(bag) : [];
  for (const value of values) rememberUser(users, pageUserFromUnknown(value));
}

function usersFromState(state: unknown, users: Map<string, PageUserRelationship>): void {
  if (!isRecord(state)) return;
  const entities = isRecord(state.entities) ? state.entities : null;
  const entityUsers = entities && isRecord(entities.users) ? entities.users : null;
  if (entityUsers) usersFromBag(entityUsers.entities ?? entityUsers, users);
  harvestUsersFromPayload(state, users);
}

function propertyStartingWith(target: object, prefix: string): unknown {
  const key = Object.getOwnPropertyNames(target).find((item) => item.startsWith(prefix));
  return key ? Reflect.get(target, key) : undefined;
}

function findStore(
  value: unknown,
  depth: number,
  seen: Set<object>,
): { getState: () => unknown } | null {
  if (depth > 10 || !isRecord(value) || seen.has(value)) return null;
  seen.add(value);
  if (isRecord(value.store) && typeof value.store.getState === "function") {
    return value.store as { getState: () => unknown };
  }
  return findStore(value.children, depth + 1, seen) ??
    findStore(value.props, depth + 1, seen);
}

function reactRoot(doc: Document): HTMLElement | null {
  return doc.querySelector("#react-root") ?? doc.querySelector("[data-reactroot]");
}

function usersFromReactStore(doc: Document, users: Map<string, PageUserRelationship>): void {
  const root = reactRoot(doc);
  const host = root?.firstElementChild ?? root;
  if (!host) return;
  const props = propertyStartingWith(host, "__reactProps$");
  const store = findStore(props, 0, new Set());
  if (!store) return;
  try {
    usersFromState(store.getState(), users);
  } catch {
    // The page store is best-effort; a React tree change must not stop DOM scanning.
  }
}

function tweetResultFrom(value: Record<string, unknown>): Record<string, unknown> | null {
  if (value.__typename === "Tweet" || isRecord(value.core) || isRecord(value.legacy)) {
    return value;
  }
  if (isRecord(value.tweet)) return value.tweet;
  if (isRecord(value.result) && (value.result.__typename === "Tweet" || isRecord(value.result.core))) {
    return value.result;
  }
  if (isRecord(value.tweet_results) && isRecord(value.tweet_results.result)) {
    return value.tweet_results.result;
  }
  if (isRecord(value.tweetResult) && isRecord(value.tweetResult.result)) {
    return value.tweetResult.result;
  }
  return null;
}

function collectUserPaths(value: unknown, users: Map<string, PageUserRelationship>): void {
  if (!isRecord(value)) return;
  rememberUser(users, pageUserFromUnknown(value));
  rememberUser(users, pageUserFromUnknown(value.user));
  const tweet = tweetResultFrom(value) ?? value;
  const core = isRecord(tweet.core) ? tweet.core : null;
  const userResults = isRecord(core?.user_results)
    ? core.user_results
    : isRecord(tweet.user_results)
      ? tweet.user_results
      : isRecord(value.user_results)
        ? value.user_results
        : isRecord(value.itemContent) && isRecord(value.itemContent.tweet_results)
          ? isRecord(value.itemContent.tweet_results.result) &&
              isRecord(value.itemContent.tweet_results.result.core)
            ? value.itemContent.tweet_results.result.core.user_results
            : null
          : null;
  const result = isRecord(userResults) && isRecord(userResults.result)
    ? userResults.result
    : null;
  rememberUser(users, pageUserFromUnknown(result));
  if (isRecord(tweet.quoted_status_result)) {
    collectUserPaths(tweet.quoted_status_result, users);
  }
  if (isRecord(tweet.legacy) && isRecord(tweet.legacy.retweeted_status_result)) {
    collectUserPaths(tweet.legacy.retweeted_status_result, users);
  }
}

function walkFiber(
  fiber: unknown,
  depth: number,
  seen: Set<object>,
  users: Map<string, PageUserRelationship>,
): void {
  if (depth > 28 || users.size >= 500 || !isRecord(fiber) || seen.has(fiber)) return;
  seen.add(fiber);
  collectUserPaths(fiber.memoizedProps, users);
  collectUserPaths(fiber.pendingProps, users);
  walkFiber(fiber.child, depth + 1, seen, users);
  walkFiber(fiber.sibling, depth + 1, seen, users);
}

function walkFiberAncestors(
  fiber: unknown,
  users: Map<string, PageUserRelationship>,
): void {
  let current = fiber;
  for (let depth = 0; depth < 24 && isRecord(current); depth += 1) {
    collectUserPaths(current.memoizedProps, users);
    collectUserPaths(current.pendingProps, users);
    current = current.return;
  }
}

function usersFromFibers(doc: Document, users: Map<string, PageUserRelationship>): void {
  const starts: Element[] = [];
  const root = reactRoot(doc);
  if (root) starts.push(root);
  for (const node of doc.querySelectorAll("article, [data-testid='tweet'], [data-testid='cellInnerDiv']")) {
    starts.push(node);
    if (starts.length >= 80) break;
  }
  const seen = new Set<object>();
  for (const node of starts) {
    const fiber = propertyStartingWith(node, "__reactFiber$") ??
      propertyStartingWith(node, "__reactInternalInstance$");
    walkFiberAncestors(fiber, users);
    walkFiber(fiber, 0, seen, users);
  }
}

export function harvestUsersFromPayload(
  payload: unknown,
  users: Map<string, PageUserRelationship> = new Map(),
): Map<string, PageUserRelationship> {
  const seen = new Set<object>();
  const budget = { remaining: 18_000 };
  const visit = (value: unknown, depth: number): void => {
    if (budget.remaining <= 0 || depth > 40 || value == null) return;
    if (typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);
    budget.remaining -= 1;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    collectUserPaths(value, users);
    for (const item of Object.values(value)) visit(item, depth + 1);
  };
  visit(payload, 0);
  return users;
}

export function mergePageUserMaps(
  ...maps: Array<Map<string, PageUserRelationship>>
): Map<string, PageUserRelationship> {
  const merged = new Map<string, PageUserRelationship>();
  for (const map of maps) {
    for (const user of map.values()) rememberUser(merged, user);
  }
  return merged;
}

export function readPageUserRelationships(doc: Document): Map<string, PageUserRelationship> {
  const users = new Map<string, PageUserRelationship>();
  usersFromReactStore(doc, users);
  usersFromFibers(doc, users);
  return users;
}

function withPageStoreIdentity(
  observation: ObservationDraft,
  pageUser: PageUserRelationship,
): ObservationDraft {
  const displayName = isUsableDisplayName(observation.displayName, observation.handle)
    ? observation.displayName
    : pageUser.displayName;
  const avatarUrl = observation.avatarUrl ?? pageUser.avatarUrl;
  if (
    displayName === observation.displayName &&
    avatarUrl === observation.avatarUrl
  ) return observation;
  return { ...observation, displayName, avatarUrl };
}

export function applyPageStoreRelationships(
  candidates: ExtractedCandidate[],
  users: Map<string, PageUserRelationship>,
): void {
  if (users.size === 0) return;
  for (const candidate of candidates) {
    const pageUser = users.get(candidate.observation.userKey);
    if (pageUser) {
      candidate.observation = withPageStoreIdentity(candidate.observation, pageUser);
    }
    if (isCollectableRelationship(candidate.observation.relationship)) continue;
    if (!pageUser) continue;
    const relationship = resolveRelationship({
      following: pageUser.following,
      followsYou: pageUser.followsYou,
      blockedBy: pageUser.blockedBy === true,
    });
    if (!isCollectableRelationship(relationship)) continue;
    candidate.observation = {
      ...candidate.observation,
      relationship,
      evidence: ["page-user-entity"],
    };
  }
}

export function isPageStoreResultMessage(value: unknown): value is PageStoreResultMessage {
  if (!isRecord(value)) return false;
  return value.source === PAGE_STORE_MESSAGE_SOURCE &&
    value.type === "result" &&
    typeof value.requestId === "string" &&
    isRecord(value.users);
}

export function isPageStoreQueryMessage(value: unknown): value is PageStoreQueryMessage {
  if (!isRecord(value)) return false;
  return value.source === PAGE_STORE_MESSAGE_SOURCE &&
    value.type === "query" &&
    typeof value.requestId === "string";
}

export async function loadPageUserRelationships(
  doc: Document,
  targetWindow: Window,
): Promise<Map<string, PageUserRelationship>> {
  const local = readPageUserRelationships(doc);
  const remote = await requestPageStoreFromBridge(targetWindow);
  return mergePageUserMaps(local, remote);
}

function requestPageStoreFromBridge(
  targetWindow: Window,
): Promise<Map<string, PageUserRelationship>> {
  if (typeof targetWindow.postMessage !== "function") {
    return Promise.resolve(new Map());
  }
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return new Promise((resolve) => {
    const timer = targetWindow.setTimeout(() => {
      targetWindow.removeEventListener("message", onMessage);
      resolve(new Map());
    }, PAGE_STORE_BRIDGE_TIMEOUT_MS);

    function onMessage(event: MessageEvent): void {
      if (event.source !== targetWindow) return;
      if (!isPageStoreResultMessage(event.data) || event.data.requestId !== requestId) {
        return;
      }
      targetWindow.clearTimeout(timer);
      targetWindow.removeEventListener("message", onMessage);
      const users = new Map<string, PageUserRelationship>();
      for (const user of Object.values(event.data.users)) {
        rememberUser(users, user);
      }
      resolve(users);
    }

    targetWindow.addEventListener("message", onMessage);
    const message: PageStoreQueryMessage = {
      source: PAGE_STORE_MESSAGE_SOURCE,
      type: "query",
      requestId,
    };
    targetWindow.postMessage(message, targetWindow.location.origin || "*");
  });
}

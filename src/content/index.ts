import type {
  GetFilterRulesResponse,
  GetFilterRulesStatusResponse,
  GetSummaryResponse,
  IncrementHideStatsResponse,
  LookupUsersResponse,
  OpenSidePanelResponse,
  QuickAddFilterRuleResponse,
  RuntimeMessage,
  UpsertObservationsMessage,
  UpsertObservationsResponse,
} from "../domain/messages";
import {
  candidateDisplayRelationship,
  isCollectableRelationship,
  isVisibleRelationship,
  relationshipRank,
} from "../domain/relationships";
import type {
  ObservationDraft,
  ObservationSummary,
  ObserverSettings,
  UserRecord,
} from "../domain/types";
import {
  compileFilterRuleSet,
  type CompiledFilterRuleSet,
  type FilterRuleSetStatus,
} from "../domain/filter-rule-matching";
import {
  emptyHideStats,
  hideStatsHaveIncrements,
  type HideStats,
} from "../domain/hide-stats";
import { getDocumentLocale, resolveUiLocale, translate, type AppLocale } from "../i18n";
import {
  CURRENT_CONSENT_VERSION,
  getSettings,
  isSettingsStorageChange,
  updateSettings,
} from "../storage/settings";
import { isFilterRulesStorageChange } from "../storage/filter-rule-keys";
import {
  removeRelationshipBadge,
  removeRelationshipBadges,
  setRelationshipBadge,
} from "./badge";
import {
  removeObserverPanel,
  renderObserverPanel,
  showObserverPanelOpenHint,
  type ObserverPanelFilterRules,
} from "./observer-panel";
import {
  hasExtensionContext,
  isExtensionContextInvalidated,
} from "./extension-context";
import {
  createPeriodicRescanController,
  type PeriodicRescanController,
} from "./periodic-rescan";
import { createObservationSignatureTracker } from "./observation-signatures";
import {
  createProcessScheduler,
  type ProcessScheduler,
} from "./process-scheduler";
import {
  applyPageStoreRelationships,
  isPageStoreUpdatedMessage,
  loadPageUserRelationships,
  mergePageUserMaps,
  pageUsersFromRecord,
  type PageUserRelationship,
} from "./page-store";
import {
  applyTimelineHiding,
  clearTimelineHiding,
  createMuteMemory,
  type TimelineHideCount,
} from "./timeline-hide";
import {
  createQuickRuleSelectionWatcher,
  refreshHoverQuickRules,
  refreshTweetMenuQuickRules,
  removeQuickRuleActions,
  showQuickRuleToast,
} from "./quick-rules";
import {
  DROPDOWN_SELECTOR,
  HOVER_CARD_SELECTOR,
  TWEET_CARET_SELECTOR,
  isInsideXUserAuthoredContent,
  scanXDocument,
  type ExtractedCandidate,
  viewerHandleFromDocument,
} from "./x-adapter";

const PROCESS_DELAY_MS = 180;
const HIDE_DELAY_MS = 0;
const observationSignatures = createObservationSignatureTracker();
const recordCache = new Map<string, UserRecord>();
const requestedUserKeys = new Set<string>();
const muteMemory = createMuteMemory();
let latestPageUsers = new Map<string, PageUserRelationship>();
let currentUrl = location.href;
let latestSettings: ObserverSettings | null = null;
let latestSummary: ObservationSummary | null = null;
let latestSummaryReadAt = 0;
let summaryRefreshInFlight = false;
let stopped = false;
let heartbeatId: number | null = null;
let observer: MutationObserver | null = null;
let periodicRescan: PeriodicRescanController | null = null;
let processScheduler: ProcessScheduler | null = null;
let hideScheduler: ProcessScheduler | null = null;
let extensionListenersRegistered = false;
let pageStoreListenerRegistered = false;
let filterRulesLoaded = false;
let filterRulesLoading: Promise<void> | null = null;
let filterRulesLoadingFor: string | null = null;
let compiledFilterRules: CompiledFilterRuleSet = compileFilterRuleSet({ rules: [] });
let compiledFilterRulesForViewer: string | null = null;
let latestFilterStatus: FilterRuleSetStatus | null = null;
let latestHideStats: HideStats = emptyHideStats();
let pageHiddenByRules = 0;
const countedTweetIds = new Set<string>();
let countedTweetIdsFor: string | null = null;
const quickBlockedHandles = new Set<string>();
let keywordWatcher: { refresh(): void; stop(): void } | null = null;
let caretClickTimers: number[] = [];
let filterStatusLoading: Promise<void> | null = null;
let filterStatusLoadingFor: string | null = null;

function currentViewerHandle(): string | null {
  return viewerHandleFromDocument(document)?.toLowerCase()
    ?? latestSettings?.viewerHandle
    ?? null;
}

function rememberQuickBlockedHandles(
  rules: GetFilterRulesResponse["ruleSet"]["rules"],
): void {
  quickBlockedHandles.clear();
  for (const rule of rules) {
    if (!rule.enabled || rule.type !== "user_handles") continue;
    for (const handle of rule.handles) quickBlockedHandles.add(handle);
  }
}

function toastSnippet(value: string): string {
  const normalized = value.normalize("NFKC").trim();
  return normalized.length <= 24 ? normalized : `${normalized.slice(0, 23)}…`;
}

function syncQuickRuleUi(): void {
  const settings = latestSettings;
  const enabled = Boolean(
    settings && settings.consentVersion >= CURRENT_CONSENT_VERSION,
  );
  const actionState = {
    locale: pageUiLocale(settings),
    viewerHandle: currentViewerHandle(),
    enabled,
    blockedHandles: quickBlockedHandles,
    onAddHandle: (handle: string) => void quickAddFilterRule("handle", handle),
    onAddKeyword: (value: string) => void quickAddFilterRule("content", value),
  };
  refreshHoverQuickRules(document, actionState);
  refreshTweetMenuQuickRules(document, actionState);
  keywordWatcher?.refresh();
}

function handleTweetCaretClick(event: Event): void {
  if (!(event.target instanceof Element)) return;
  if (!event.target.closest(TWEET_CARET_SELECTOR)) return;
  const view = document.defaultView;
  for (const id of caretClickTimers) view?.clearTimeout(id);
  caretClickTimers = [0, 50, 160].map((delay) =>
    view?.setTimeout(() => {
      if (!stopped) syncQuickRuleUi();
    }, delay) ?? 0
  );
}

function mutationTouchesQuickRuleHost(mutation: MutationRecord): boolean {
  if (mutation.type === "attributes") {
    if (!(mutation.target instanceof Element)) return false;
    if (mutation.attributeName === "aria-expanded") {
      return mutation.target.closest(TWEET_CARET_SELECTOR) !== null;
    }
    return mutation.target.closest(`${HOVER_CARD_SELECTOR}, ${DROPDOWN_SELECTOR}`) !== null;
  }
  if (mutation.type !== "childList") return false;
  if (
    mutation.target instanceof Element &&
    mutation.target.closest(`${HOVER_CARD_SELECTOR}, ${DROPDOWN_SELECTOR}`)
  ) {
    return true;
  }
  for (const node of mutation.addedNodes) {
    if (!(node instanceof Element)) continue;
    if (
      node.matches(HOVER_CARD_SELECTOR) ||
      node.matches(DROPDOWN_SELECTOR) ||
      node.querySelector(`${HOVER_CARD_SELECTOR}, ${DROPDOWN_SELECTOR}`)
    ) {
      return true;
    }
  }
  return false;
}

async function quickAddFilterRule(
  kind: "handle" | "content",
  value: string,
): Promise<void> {
  const locale = pageUiLocale();
  const clipped = kind === "content"
    ? value.normalize("NFKC").trim().slice(0, 256)
    : value.trim();
  if (!clipped) return;
  try {
    const response = await chrome.runtime.sendMessage({
      type: "filter-rules:quick-add",
      kind,
      value: clipped,
      viewerHandle: currentViewerHandle(),
    }) as QuickAddFilterRuleResponse | { ok: false; error: string };
    if (!response.ok) throw new Error(response.error);
    if (kind === "handle") quickBlockedHandles.add(response.value.toLowerCase());
    latestFilterStatus = response.status;
    if (latestSettings) {
      latestSettings = {
        ...latestSettings,
        hideByFilterRules: response.enabledHiding,
      };
      renderPanel(latestSettings);
    }
    const toastKey = kind === "handle"
      ? (response.added ? "quickRuleToastHandleAdded" : "quickRuleToastHandleExists")
      : (response.added ? "quickRuleToastKeywordAdded" : "quickRuleToastKeywordExists");
    showQuickRuleToast(document, translate(locale, toastKey, {
      handle: response.value,
      value: toastSnippet(response.value),
    }));
    syncQuickRuleUi();
    scheduleHide();
    scheduleProcess();
  } catch (error) {
    handleRuntimeError(error, "Could not save a quick blacklist rule");
    showQuickRuleToast(document, translate(locale, "quickRuleToastFailed"));
  }
}

function resetCountedTweetIdsIfNeeded(): void {
  const viewer = currentViewerHandle() ?? "";
  if (countedTweetIdsFor === viewer) return;
  countedTweetIdsFor = viewer;
  countedTweetIds.clear();
}

function dockFilterRules(settings: ObserverSettings): ObserverPanelFilterRules | null {
  if (settings.consentVersion < CURRENT_CONSENT_VERSION) return null;
  return {
    applying: settings.hideByFilterRules,
    ruleCount: latestFilterStatus?.ruleCount ?? 0,
    activeRuleCount: latestFilterStatus?.activeRuleCount ?? 0,
    pageHiddenByRules,
    lifetimeHiddenByRules: latestHideStats.hiddenByRules,
  };
}

function refreshFilterStatus(): Promise<void> {
  const viewerHandle = currentViewerHandle();
  const requested = viewerHandle ?? "";
  if (filterStatusLoading && filterStatusLoadingFor === requested) {
    return filterStatusLoading;
  }
  filterStatusLoadingFor = requested;
  filterStatusLoading = chrome.runtime.sendMessage({
    type: "filter-rules:status",
    viewerHandle,
  })
    .then((response: GetFilterRulesStatusResponse | { ok: false; error: string }) => {
      if (requested !== (currentViewerHandle() ?? "")) return;
      if (!response.ok) throw new Error(response.error);
      latestFilterStatus = response.status;
      latestHideStats = response.hideStats ?? emptyHideStats();
    }).catch((error: unknown) => {
      handleRuntimeError(error, "Could not read custom filter rule status");
    }).finally(() => {
      if (filterStatusLoadingFor === requested) {
        filterStatusLoading = null;
        filterStatusLoadingFor = null;
      }
    });
  return filterStatusLoading;
}

function ensureFilterRulesLoaded(): Promise<void> {
  const viewerHandle = currentViewerHandle();
  if (filterRulesLoaded && compiledFilterRulesForViewer === viewerHandle) {
    return Promise.resolve();
  }
  if (filterRulesLoading && filterRulesLoadingFor === viewerHandle) {
    return filterRulesLoading;
  }
  const requested = viewerHandle;
  filterRulesLoadingFor = viewerHandle;
  filterRulesLoading = chrome.runtime.sendMessage({
    type: "filter-rules:get",
    viewerHandle,
  })
    .then((response: GetFilterRulesResponse | { ok: false; error: string }) => {
      if (requested !== currentViewerHandle()) return;
      if (!response.ok) throw new Error(response.error);
      compiledFilterRules = compileFilterRuleSet(response.ruleSet);
      compiledFilterRulesForViewer = requested;
      filterRulesLoaded = true;
      rememberQuickBlockedHandles(response.ruleSet.rules);
    }).catch((error: unknown) => {
      if (requested !== currentViewerHandle()) return;
      compiledFilterRules = compileFilterRuleSet({ rules: [] });
      compiledFilterRulesForViewer = requested;
      filterRulesLoaded = true;
      throw error;
    }).finally(() => {
      if (filterRulesLoadingFor === requested) {
        filterRulesLoading = null;
        filterRulesLoadingFor = null;
      }
    });
  return filterRulesLoading;
}

function handleStorageChanged(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
): void {
  if (isSettingsStorageChange(changes, areaName)) {
    filterRulesLoaded = false;
    compiledFilterRulesForViewer = null;
    void refreshFilterStatus().then(() => {
      if (!stopped && latestSettings) renderPanel(latestSettings);
    });
    scheduleHide();
    scheduleProcess();
  }
  if (isFilterRulesStorageChange(changes, areaName, currentViewerHandle())) {
    filterRulesLoaded = false;
    compiledFilterRulesForViewer = null;
    void refreshFilterStatus().then(() => {
      if (!stopped && latestSettings) renderPanel(latestSettings);
    });
    if (
      !latestSettings?.hideByFilterRules ||
      latestSettings.consentVersion < CURRENT_CONSENT_VERSION
    ) {
      compiledFilterRules = compileFilterRuleSet({ rules: [] });
      scheduleHide();
      return;
    }
    void ensureFilterRulesLoaded().then(() => {
      scheduleHide();
      scheduleProcess();
    }).catch((error: unknown) => {
      handleRuntimeError(error, "Could not refresh custom filter rules");
      scheduleHide();
    });
  }
}

function timelineHidingEnabled(settings: ObserverSettings | null): boolean {
  return Boolean(
    settings?.hideMutedAccounts ||
    settings?.hideBlockedByAccounts ||
    settings?.hideByFilterRules
  );
}

function handleRuntimeMessage(message: RuntimeMessage): false {
  if (message.type === "data:changed") {
    recordCache.clear();
    requestedUserKeys.clear();
    if (latestSettings?.observerEnabled || timelineHidingEnabled(latestSettings)) {
      scheduleHide();
      scheduleProcess();
    }
    if (latestSettings) void refreshSummary();
  }
  return false;
}

function removeExtensionListeners(): void {
  if (!extensionListenersRegistered) return;
  extensionListenersRegistered = false;
  if (!hasExtensionContext()) return;
  chrome.storage.onChanged.removeListener(handleStorageChanged);
  chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
}

function rememberPageUsers(users: Map<string, PageUserRelationship>): void {
  latestPageUsers = mergePageUserMaps(latestPageUsers, users);
  for (const user of users.values()) {
    muteMemory.remember(user.handle.toLowerCase(), user.muting);
  }
}

function revealAllHiddenTweets(): void {
  clearTimelineHiding(document);
  if (pageHiddenByRules === 0) return;
  pageHiddenByRules = 0;
  if (latestSettings) renderPanel(latestSettings);
}

function recordNewHides(count: TimelineHideCount): void {
  pageHiddenByRules = count.pageHiddenByRules;
  if (latestSettings) renderPanel(latestSettings);
  resetCountedTweetIdsIfNeeded();
  const delta = {
    hiddenByRules: 0,
    hiddenByMuted: 0,
    hiddenByBlockedBy: 0,
  };
  const added: string[] = [];
  for (const item of count.discoveries) {
    if (!item.statusId || countedTweetIds.has(item.statusId)) continue;
    countedTweetIds.add(item.statusId);
    added.push(item.statusId);
    if (item.byRules) delta.hiddenByRules += 1;
    else if (item.byMuted) delta.hiddenByMuted += 1;
    else if (item.byBlockedBy) delta.hiddenByBlockedBy += 1;
  }
  if (!hideStatsHaveIncrements(delta)) return;
  void chrome.runtime.sendMessage({
    type: "hide-stats:increment",
    viewerHandle: currentViewerHandle(),
    ...delta,
  }).then((response: IncrementHideStatsResponse | { ok: false; error: string }) => {
    if (stopped) return;
    if (!response.ok) {
      for (const id of added) countedTweetIds.delete(id);
      return;
    }
    latestHideStats = response.hideStats;
    if (latestSettings) renderPanel(latestSettings);
  }).catch((error: unknown) => {
    for (const id of added) countedTweetIds.delete(id);
    handleRuntimeError(error, "Could not record timeline hide counts");
  });
}

function applyHideNow(): void {
  if (stopped) return;
  const settings = latestSettings;
  if (!settings) return;
  if (
    settings.consentVersion < CURRENT_CONSENT_VERSION ||
    !timelineHidingEnabled(settings)
  ) {
    revealAllHiddenTweets();
    return;
  }
  const viewerHandle = viewerHandleFromDocument(document);
  const viewerKey = viewerHandle?.toLowerCase() ?? settings.viewerHandle;
  const candidates = scanXDocument(document, location.href).filter(
    (candidate) => candidate.observation.userKey !== viewerKey,
  );
  applyPageStoreRelationships(candidates, latestPageUsers);
  recordNewHides(applyTimelineHiding({
    root: document,
    candidates,
    hideMutedAccounts: settings.hideMutedAccounts,
    hideBlockedByAccounts: settings.hideBlockedByAccounts,
    filterRules: settings.hideByFilterRules ? compiledFilterRules : null,
    pageUsers: latestPageUsers,
    records: recordCache,
    muteMemory,
  }));
}

function handlePageStoreUpdated(event: MessageEvent): void {
  if (event.source !== window) return;
  if (!isPageStoreUpdatedMessage(event.data)) return;
  rememberPageUsers(pageUsersFromRecord(event.data.users));
  scheduleHide();
}

function stopContentScript(): void {
  if (stopped) return;
  stopped = true;
  processScheduler?.stop();
  processScheduler = null;
  hideScheduler?.stop();
  hideScheduler = null;
  if (heartbeatId !== null) window.clearInterval(heartbeatId);
  heartbeatId = null;
  periodicRescan?.stop();
  periodicRescan = null;
  observer?.disconnect();
  if (pageStoreListenerRegistered) {
    window.removeEventListener("message", handlePageStoreUpdated);
    pageStoreListenerRegistered = false;
  }
  removeExtensionListeners();
  removeRelationshipBadges();
  clearTimelineHiding(document);
  muteMemory.clear();
  filterRulesLoaded = false;
  filterRulesLoading = null;
  compiledFilterRules = compileFilterRuleSet({ rules: [] });
  latestFilterStatus = null;
  filterStatusLoading = null;
  filterStatusLoadingFor = null;
  latestPageUsers = new Map();
  keywordWatcher?.stop();
  keywordWatcher = null;
  document.removeEventListener("click", handleTweetCaretClick, true);
  for (const id of caretClickTimers) window.clearTimeout(id);
  caretClickTimers = [];
  quickBlockedHandles.clear();
  removeQuickRuleActions(document);
  removeObserverPanel(document);
}

function handleRuntimeError(error: unknown, message: string): void {
  if (isExtensionContextInvalidated(error)) {
    stopContentScript();
    return;
  }
  console.warn(`[Not Brother] ${message}`, error);
}

function syncPageTheme(): void {
  let channels: number[] | null = null;
  for (const target of [document.body, document.documentElement]) {
    if (!target) continue;
    const values = getComputedStyle(target).backgroundColor.match(/[\d.]+/g)?.map(Number);
    if (!values || values.length < 3 || (values.length >= 4 && values[3] === 0)) continue;
    channels = values.slice(0, 3);
    break;
  }
  if (!channels) {
    document.documentElement.dataset.xroTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    return;
  }
  const [red = 255, green = 255, blue = 255] = channels;
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  document.documentElement.dataset.xroTheme = luminance < 128 ? "dark" : "light";
}

function pageUiLocale(settings: ObserverSettings | null = latestSettings): AppLocale {
  return resolveUiLocale(settings?.uiLocale, getDocumentLocale(document));
}

async function openSidePanel(): Promise<void> {
  try {
    const response = (await chrome.runtime.sendMessage({
      type: "sidepanel:open",
    })) as OpenSidePanelResponse;
    if (!response.ok) await handleSidePanelOpenFailure();
  } catch (error) {
    if (isExtensionContextInvalidated(error)) stopContentScript();
    else await handleSidePanelOpenFailure();
  }
}

async function handleSidePanelOpenFailure(): Promise<void> {
  if (
    latestSettings &&
    latestSettings.consentVersion < CURRENT_CONSENT_VERSION
  ) {
    try {
      await chrome.runtime.sendMessage({ type: "dashboard:open" });
      return;
    } catch (error) {
      if (isExtensionContextInvalidated(error)) {
        stopContentScript();
        return;
      }
    }
  }
  showObserverPanelOpenHint(document, pageUiLocale());
}

async function openFilterRules(): Promise<void> {
  try {
    const response = (await chrome.runtime.sendMessage({
      type: "sidepanel:open",
      tab: "filter-rules",
    })) as OpenSidePanelResponse;
    if (response.ok) return;
  } catch (error) {
    handleRuntimeError(error, "Could not open the filter rules editor");
  }
  try {
    await chrome.runtime.sendMessage({
      type: "dashboard:open",
      section: "filter-rules",
    });
  } catch (error) {
    handleRuntimeError(error, "Could not open the filter rules editor");
  }
}

function renderPanel(settings: ObserverSettings): void {
  const hasConsent = settings.consentVersion >= CURRENT_CONSENT_VERSION;
  renderObserverPanel(document, {
    state: hasConsent
      ? settings.observerEnabled ? "active" : "paused"
      : "needs-consent",
    summary: latestSummary,
    locale: pageUiLocale(settings),
    collapsed: settings.dockCollapsed,
    version: chrome.runtime.getManifest().version,
    filterRules: dockFilterRules(settings),
  }, () => void openSidePanel(), (collapsed) => void setPanelCollapsed(collapsed), () => {
    void openFilterRules();
  });
}

async function setPanelCollapsed(collapsed: boolean): Promise<void> {
  if (!latestSettings || latestSettings.dockCollapsed === collapsed) return;
  const previous = latestSettings;
  latestSettings = { ...previous, dockCollapsed: collapsed };
  renderPanel(latestSettings);
  try {
    latestSettings = await updateSettings({ dockCollapsed: collapsed });
  } catch (error) {
    latestSettings = previous;
    if (!stopped) renderPanel(previous);
    handleRuntimeError(error, "Could not save the observer dock presentation");
  }
}

async function refreshSummary(): Promise<void> {
  if (summaryRefreshInFlight) return;
  summaryRefreshInFlight = true;
  try {
    const response = (await chrome.runtime.sendMessage({
      type: "summary:get",
    })) as GetSummaryResponse | { ok: false; error: string };
    if (stopped) return;
    if (response.ok) {
      latestSummary = response.summary;
      latestSummaryReadAt = Date.now();
      if (latestSettings) renderPanel(latestSettings);
    }
  } catch (error) {
    handleRuntimeError(error, "Could not read observation summary");
  } finally {
    latestSummaryReadAt = Date.now();
    summaryRefreshInFlight = false;
  }
}

function bestObservations(candidates: ExtractedCandidate[]): ObservationDraft[] {
  const byUser = new Map<string, ObservationDraft>();
  for (const { observation } of candidates) {
    const existing = byUser.get(observation.userKey);
    if (
      !existing ||
      relationshipRank(observation.relationship) > relationshipRank(existing.relationship)
    ) {
      byUser.set(observation.userKey, observation);
    }
  }
  return [...byUser.values()];
}

function annotate(candidates: ExtractedCandidate[]): void {
  const locale = pageUiLocale();
  for (const candidate of candidates) {
    const stored = recordCache.get(candidate.observation.userKey);
    const relationship = candidateDisplayRelationship(
      candidate.observation.relationship,
      stored,
    );
    if (!relationship) {
      removeRelationshipBadge(candidate.anchor);
      continue;
    }
    const currentRelationship = isVisibleRelationship(candidate.observation.relationship)
      ? candidate.observation.relationship
      : stored?.currentRelationship;
    setRelationshipBadge(
      candidate.anchor,
      relationship,
      candidate.observation.handle,
      locale,
      currentRelationship,
    );
  }
}

async function hydrateRecordCache(candidates: ExtractedCandidate[]): Promise<void> {
  const userKeys = [...new Set(candidates.map((item) => item.observation.userKey))]
    .filter((userKey) => !requestedUserKeys.has(userKey));
  if (userKeys.length === 0) return;
  for (const userKey of userKeys) requestedUserKeys.add(userKey);
  try {
    const response = (await chrome.runtime.sendMessage({
      type: "users:lookup",
      userKeys,
    })) as LookupUsersResponse | { ok: false; error: string };
    if (!response.ok) {
      for (const userKey of userKeys) requestedUserKeys.delete(userKey);
      return;
    }
    for (const user of response.users) recordCache.set(user.key, user);
  } catch (error) {
    for (const userKey of userKeys) requestedUserKeys.delete(userKey);
    handleRuntimeError(error, "Could not read known relationship records");
  }
}

async function processPage(): Promise<void> {
  if (stopped) return;
  syncPageTheme();
  const settings = await getSettings();
  if (stopped) return;
  latestSettings = settings;
  if (settings.consentVersion >= CURRENT_CONSENT_VERSION) {
    try {
      await refreshFilterStatus();
    } catch (error) {
      handleRuntimeError(error, "Could not read custom filter rule status");
    }
    if (stopped) return;
  }
  if (settings.hideByFilterRules) {
    try {
      await ensureFilterRulesLoaded();
    } catch (error) {
      handleRuntimeError(error, "Could not load custom filter rules");
    }
    if (stopped) return;
  }
  renderPanel(settings);
  const hasConsent = settings.consentVersion >= CURRENT_CONSENT_VERSION;
  const hidingEnabled = timelineHidingEnabled(settings);
  if (!hasConsent) {
    removeRelationshipBadges();
    revealAllHiddenTweets();
    removeQuickRuleActions();
    return;
  }
  syncQuickRuleUi();
  if (!settings.observerEnabled && !hidingEnabled) {
    removeRelationshipBadges();
    revealAllHiddenTweets();
    return;
  }

  if (latestSummary === null || Date.now() - latestSummaryReadAt > 30_000) {
    void refreshSummary();
  }
  const viewerHandle = viewerHandleFromDocument(document);
  const viewerKey = viewerHandle?.toLowerCase() ?? settings.viewerHandle;
  const candidates = scanXDocument(document, location.href).filter(
    (candidate) => candidate.observation.userKey !== viewerKey,
  );
  const pageUsers = await loadPageUserRelationships(document, window);
  rememberPageUsers(pageUsers);
  applyPageStoreRelationships(candidates, latestPageUsers);
  if (stopped) return;
  const collectableCandidates = candidates.filter((item) =>
    isCollectableRelationship(item.observation.relationship),
  );

  if (settings.observerEnabled || hidingEnabled) {
    await hydrateRecordCache(candidates);
    if (stopped) return;
  }

  if (hidingEnabled) applyHideNow();

  if (!settings.observerEnabled) {
    removeRelationshipBadges();
    return;
  }

  if (settings.showBadges) annotate(candidates);
  else removeRelationshipBadges();

  const observations = observationSignatures.filterUnsent(
    bestObservations(collectableCandidates),
  );
  const viewerNeedsSync = viewerKey !== null && settings.viewerHandle !== viewerKey;
  if (observations.length === 0 && !viewerNeedsSync) return;

  const message: UpsertObservationsMessage = {
    type: "observations:upsert",
    observations,
    viewerHandle,
  };
  try {
    const response = (await chrome.runtime.sendMessage(message)) as
      | UpsertObservationsResponse
      | { ok: false; error: string };
    if (response.ok) {
      observationSignatures.markPersisted(observations, response.users);
      for (const user of response.users) recordCache.set(user.key, user);
      if (settings.showBadges) annotate(candidates);
      await refreshSummary();
    }
  } catch (error) {
    handleRuntimeError(error, "Could not persist observations");
  }
}

function scheduleProcess(): void {
  processScheduler?.request();
}

function scheduleHide(): void {
  hideScheduler?.request();
}

function nodeIsInsideInjectedUi(node: Node): boolean {
  const element = node instanceof Element ? node : node.parentElement;
  return Boolean(
    element?.closest("[data-xro-badge], [data-xro-overlay], [data-xro-quick-rule]"),
  );
}

observer = new MutationObserver((mutations) => {
  if (stopped) return;
  if (
    mutations.every((mutation) =>
      nodeIsInsideInjectedUi(mutation.target) ||
      isInsideXUserAuthoredContent(mutation.target)
    )
  ) {
    return;
  }
  if (latestSettings && mutations.some(mutationTouchesQuickRuleHost)) {
    syncQuickRuleUi();
  }
  scheduleHide();
  scheduleProcess();
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: [
    "aria-disabled",
    "aria-expanded",
    "aria-hidden",
    "aria-label",
    "data-testid",
    "disabled",
    "hidden",
    "href",
    "inert",
    "role",
  ],
});

heartbeatId = window.setInterval(() => {
  if (stopped) return;
  syncPageTheme();
  if (
    latestSettings?.observerEnabled &&
    Date.now() - latestSummaryReadAt > 30_000
  ) {
    void refreshSummary();
  }
  if (location.href === currentUrl) return;
  currentUrl = location.href;
  scheduleHide();
  scheduleProcess();
}, 800);

if (hasExtensionContext()) {
  processScheduler = createProcessScheduler({
    window,
    delayMs: PROCESS_DELAY_MS,
    task: processPage,
    onError: (error) => handleRuntimeError(error, "Could not process the current page"),
  });
  hideScheduler = createProcessScheduler({
    window,
    delayMs: HIDE_DELAY_MS,
    task: async () => applyHideNow(),
    onError: (error) => handleRuntimeError(error, "Could not apply timeline filters"),
  });

  chrome.storage.onChanged.addListener(handleStorageChanged);
  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
  extensionListenersRegistered = true;
  window.addEventListener("message", handlePageStoreUpdated);
  pageStoreListenerRegistered = true;

  periodicRescan = createPeriodicRescanController({
    document,
    window,
    shouldRescan: () => Boolean(
      latestSettings &&
      latestSettings.consentVersion >= CURRENT_CONSENT_VERSION &&
      (latestSettings.observerEnabled || timelineHidingEnabled(latestSettings)),
    ),
    onRescan: () => {
      scheduleHide();
      scheduleProcess();
    },
  });
  periodicRescan.start();

  keywordWatcher = createQuickRuleSelectionWatcher(document, () => ({
    locale: pageUiLocale(),
    enabled: Boolean(
      latestSettings &&
      latestSettings.consentVersion >= CURRENT_CONSENT_VERSION,
    ),
    onAddKeyword: (value) => void quickAddFilterRule("content", value),
  }));
  document.addEventListener("click", handleTweetCaretClick, true);

  scheduleHide();
  scheduleProcess();
} else {
  stopContentScript();
}

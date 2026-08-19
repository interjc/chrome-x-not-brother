import type {
  GetSummaryResponse,
  LookupUsersResponse,
  OpenSidePanelResponse,
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
import { getDocumentLocale } from "../i18n";
import {
  CURRENT_CONSENT_VERSION,
  getSettings,
  SETTINGS_KEY,
  updateSettings,
} from "../storage/settings";
import {
  removeRelationshipBadge,
  removeRelationshipBadges,
  setRelationshipBadge,
} from "./badge";
import {
  removeObserverPanel,
  renderObserverPanel,
  showObserverPanelOpenHint,
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
  loadPageUserRelationships,
} from "./page-store";
import {
  scanXDocument,
  type ExtractedCandidate,
  viewerHandleFromDocument,
} from "./x-adapter";

const PROCESS_DELAY_MS = 180;
const observationSignatures = createObservationSignatureTracker();
const recordCache = new Map<string, UserRecord>();
const requestedUserKeys = new Set<string>();
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
let extensionListenersRegistered = false;

function handleStorageChanged(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
): void {
  if (areaName === "local" && changes[SETTINGS_KEY]) scheduleProcess();
}

function handleRuntimeMessage(message: RuntimeMessage): false {
  if (message.type === "data:changed") {
    recordCache.clear();
    requestedUserKeys.clear();
    if (latestSettings?.observerEnabled) scheduleProcess();
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

function stopContentScript(): void {
  if (stopped) return;
  stopped = true;
  processScheduler?.stop();
  processScheduler = null;
  if (heartbeatId !== null) window.clearInterval(heartbeatId);
  heartbeatId = null;
  periodicRescan?.stop();
  periodicRescan = null;
  observer?.disconnect();
  removeExtensionListeners();
  removeRelationshipBadges();
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

async function openSidePanel(): Promise<void> {
  try {
    const response = (await chrome.runtime.sendMessage({
      type: "sidepanel:open",
    })) as OpenSidePanelResponse;
    if (!response.ok) showObserverPanelOpenHint(document);
  } catch (error) {
    if (isExtensionContextInvalidated(error)) stopContentScript();
    else showObserverPanelOpenHint(document);
  }
}

function renderPanel(settings: ObserverSettings): void {
  const hasConsent = settings.consentVersion >= CURRENT_CONSENT_VERSION;
  renderObserverPanel(document, {
    state: hasConsent
      ? settings.observerEnabled ? "active" : "paused"
      : "needs-consent",
    summary: latestSummary,
    locale: getDocumentLocale(document),
    collapsed: settings.dockCollapsed,
    version: chrome.runtime.getManifest().version,
  }, () => void openSidePanel(), (collapsed) => void setPanelCollapsed(collapsed));
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
  const locale = getDocumentLocale(document);
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
  renderPanel(settings);
  if (
    settings.consentVersion < CURRENT_CONSENT_VERSION ||
    !settings.observerEnabled
  ) {
    removeRelationshipBadges();
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
  applyPageStoreRelationships(
    candidates,
    await loadPageUserRelationships(document, window),
  );
  if (stopped) return;
  const collectableCandidates = candidates.filter((item) =>
    isCollectableRelationship(item.observation.relationship),
  );

  await hydrateRecordCache(candidates);
  if (stopped) return;

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

function nodeIsInsideInjectedUi(node: Node): boolean {
  const element = node instanceof Element ? node : node.parentElement;
  return Boolean(element?.closest("[data-xro-badge], [data-xro-overlay]"));
}

observer = new MutationObserver((mutations) => {
  if (stopped) return;
  if (
    mutations.every((mutation) => nodeIsInsideInjectedUi(mutation.target))
  ) {
    return;
  }
  scheduleProcess();
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: [
    "aria-disabled",
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
  scheduleProcess();
}, 800);

if (hasExtensionContext()) {
  processScheduler = createProcessScheduler({
    window,
    delayMs: PROCESS_DELAY_MS,
    task: processPage,
    onError: (error) => handleRuntimeError(error, "Could not process the current page"),
  });

  chrome.storage.onChanged.addListener(handleStorageChanged);
  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
  extensionListenersRegistered = true;

  periodicRescan = createPeriodicRescanController({
    document,
    window,
    shouldRescan: () => Boolean(
      latestSettings &&
      latestSettings.consentVersion >= CURRENT_CONSENT_VERSION &&
      latestSettings.observerEnabled,
    ),
    onRescan: scheduleProcess,
  });
  periodicRescan.start();

  scheduleProcess();
} else {
  stopContentScript();
}

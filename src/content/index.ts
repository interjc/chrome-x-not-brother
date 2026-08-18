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
  scanXDocument,
  type ExtractedCandidate,
  viewerHandleFromDocument,
} from "./x-adapter";

const PROCESS_DELAY_MS = 180;
const sentSignatures = new Map<string, string>();
const recordCache = new Map<string, UserRecord>();
const requestedUserKeys = new Set<string>();
let scheduled: number | null = null;
let currentUrl = location.href;
let latestSettings: ObserverSettings | null = null;
let latestSummary: ObservationSummary | null = null;
let latestSummaryReadAt = 0;
let summaryRefreshInFlight = false;
let stopped = false;
let heartbeatId: number | null = null;
let observer: MutationObserver | null = null;

function stopContentScript(): void {
  if (stopped) return;
  stopped = true;
  if (scheduled !== null) window.clearTimeout(scheduled);
  scheduled = null;
  if (heartbeatId !== null) window.clearInterval(heartbeatId);
  heartbeatId = null;
  observer?.disconnect();
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

function candidateSignature(observation: ObservationDraft): string {
  return [
    observation.userKey,
    observation.relationship,
    observation.sourceUrl,
    observation.evidence.join("|"),
  ].join("::");
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
    const relationship = candidateDisplayRelationship(
      candidate.observation.relationship,
      recordCache.get(candidate.observation.userKey),
    );
    if (!relationship) {
      removeRelationshipBadge(candidate.anchor);
      continue;
    }
    setRelationshipBadge(
      candidate.anchor,
      relationship,
      candidate.observation.handle,
      locale,
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
  scheduled = null;
  if (stopped) return;
  syncPageTheme();
  const settings = await getSettings();
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
  const candidates = scanXDocument(document, location.href).filter(
    (candidate) => candidate.observation.userKey !== settings.viewerHandle,
  );
  const collectableCandidates = candidates.filter((item) =>
    isCollectableRelationship(item.observation.relationship),
  );

  await hydrateRecordCache(candidates);

  if (settings.showBadges) annotate(candidates);
  else removeRelationshipBadges();

  const observations = bestObservations(collectableCandidates).filter((observation) => {
    const signature = candidateSignature(observation);
    if (sentSignatures.get(observation.userKey) === signature) return false;
    sentSignatures.set(observation.userKey, signature);
    return true;
  });
  const viewerKey = viewerHandle?.toLowerCase() ?? null;
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
      for (const user of response.users) recordCache.set(user.key, user);
      if (settings.showBadges) annotate(candidates);
      await refreshSummary();
    }
  } catch (error) {
    handleRuntimeError(error, "Could not persist observations");
  }
}

function scheduleProcess(): void {
  if (stopped || scheduled !== null) return;
  scheduled = window.setTimeout(() => {
    void processPage().catch((error: unknown) =>
      handleRuntimeError(error, "Could not process the current page"));
  }, PROCESS_DELAY_MS);
}

observer = new MutationObserver((mutations) => {
  if (stopped) return;
  if (
    mutations.every((mutation) =>
      [...mutation.addedNodes, ...mutation.removedNodes].every(
        (node) =>
          node instanceof Element &&
          node.closest("[data-xro-badge], [data-xro-overlay]"),
      ),
    )
  ) {
    return;
  }
  scheduleProcess();
});

observer.observe(document.documentElement, { childList: true, subtree: true });

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
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[SETTINGS_KEY]) scheduleProcess();
  });

  chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
    if (message.type === "data:changed" && latestSettings?.observerEnabled) {
      recordCache.clear();
      requestedUserKeys.clear();
      scheduleProcess();
      void refreshSummary();
    }
    return false;
  });

  scheduleProcess();
} else {
  stopContentScript();
}

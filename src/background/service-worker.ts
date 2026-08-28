import type {
  GetFilterRulesResponse,
  GetFilterRulesStatusResponse,
  GetSummaryResponse,
  IncrementHideStatsResponse,
  LookupUsersResponse,
  OpenDashboardMessage,
  OpenSidePanelResponse,
  QuickAddFilterRuleResponse,
  RuntimeMessage,
  UpsertObservationsMessage,
  UpsertObservationsResponse,
} from "../domain/messages";
import { appendQuickFilterRule } from "../domain/filter-rules";
import { filterRuleSetStatus } from "../domain/filter-rule-matching";
import type { ObserverSettings } from "../domain/types";
import { resolveUiLocale } from "../i18n";
import { actionPresentation } from "./action-state";
import {
  CONSENT_CONTEXT_MENU_ID,
  syncConsentContextMenu,
} from "./consent-entry";
import { broadcastDataChanged } from "./data-change-broadcast";
import {
  deleteUserRecord,
  getObservationSummary,
  getUserRecords,
  purgeUnknownObservations,
  upsertObservations,
} from "../storage/database";
import {
  CURRENT_CONSENT_VERSION,
  SETTINGS_KEY,
  coerceSettings,
  getSettings,
  updateSettings,
} from "../storage/settings";
import { getFilterRuleSet, saveFilterRuleSet } from "../storage/filter-rules";
import { getHideStats, incrementHideStats } from "../storage/hide-stats";
import { hideStatsHaveIncrements, type HideStatsDelta } from "../domain/hide-stats";
import {
  closeExtensionSidePanel,
  hydrateTrackedSidePanels,
  isTrackedSidePanelOpen,
  rememberSidePanelClosed,
  rememberSidePanelOpen,
  watchSidePanelVisibility,
} from "./side-panel-visibility";

chrome.runtime.onInstalled.addListener(async (details) => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  await purgeUnknownObservations();
  const settings = await getSettings();
  await syncExtensionUiState(settings);
  if (details.reason === "install") {
    await chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html?welcome=1") });
  }
});

void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
void purgeUnknownObservations();
void initializeActionState();
watchSidePanelVisibility();
void hydrateTrackedSidePanels();

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONSENT_CONTEXT_MENU_ID) return;
  const sidePanelOpen = tab?.windowId === undefined
    ? null
    : chrome.sidePanel.open({ windowId: tab.windowId });
  void openConsentSurface(sidePanelOpen);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync" || !changes[SETTINGS_KEY]) return;
  const next = coerceSettings(
    changes[SETTINGS_KEY].newValue as Partial<ObserverSettings> | undefined,
  );
  void syncExtensionUiStateFromStorage(next);
});

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, sender, sendResponse: (response?: unknown) => void) => {
    if (message.type === "observations:upsert") {
      if (!sender.url?.startsWith("https://x.com/")) {
        sendResponse({ ok: false, error: "Observation messages are accepted only from x.com" });
        return false;
      }
      void handleUpsert(message)
        .then((response) => sendResponse(response))
        .catch((error: unknown) => {
          const detail = error instanceof Error ? error.message : String(error);
          sendResponse({ ok: false, error: detail });
        });
      return true;
    }

    if (message.type === "dashboard:open") {
      void openDashboard(message).then(() => sendResponse({ ok: true }));
      return true;
    }

    if (message.type === "summary:get") {
      void getSettings()
        .then((settings) => getObservationSummary(settings.viewerHandle))
        .then((summary) => sendResponse({ ok: true, summary } satisfies GetSummaryResponse))
        .catch((error: unknown) => sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }));
      return true;
    }

    if (message.type === "users:lookup") {
      if (!sender.url?.startsWith("https://x.com/")) {
        sendResponse({ ok: false, error: "User lookups are accepted only from x.com" });
        return false;
      }
      void getSettings()
        .then(async (settings) => {
          if (
            settings.consentVersion < CURRENT_CONSENT_VERSION ||
            !settings.observerEnabled
          ) return [];
          return getUserRecords(message.userKeys, settings.viewerHandle);
        })
        .then((users) => sendResponse({ ok: true, users } satisfies LookupUsersResponse))
        .catch((error: unknown) => sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }));
      return true;
    }

    if (message.type === "filter-rules:get") {
      if (!sender.url?.startsWith("https://x.com/")) {
        sendResponse({ ok: false, error: "Filter rules are available only to x.com" });
        return false;
      }
      void getSettings()
        .then(async (settings) => {
          if (
            settings.consentVersion < CURRENT_CONSENT_VERSION ||
            !settings.hideByFilterRules
          ) {
            throw new Error("Custom timeline filtering is not enabled");
          }
          return getFilterRuleSet(message.viewerHandle ?? settings.viewerHandle);
        })
        .then((ruleSet) => sendResponse({
          ok: true,
          ruleSet,
        } satisfies GetFilterRulesResponse))
        .catch((error: unknown) => sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }));
      return true;
    }

    if (message.type === "filter-rules:quick-add") {
      if (!sender.url?.startsWith("https://x.com/")) {
        sendResponse({ ok: false, error: "Quick filter rules are available only to x.com" });
        return false;
      }
      void getSettings()
        .then(async (settings) => {
          if (settings.consentVersion < CURRENT_CONSENT_VERSION) {
            throw new Error("Observation consent is required");
          }
          const viewerHandle = message.viewerHandle ?? settings.viewerHandle;
          const current = await getFilterRuleSet(viewerHandle);
          const result = appendQuickFilterRule(current, message.kind, message.value);
          const saved = result.added
            ? await saveFilterRuleSet(result.ruleSet, viewerHandle)
            : result.ruleSet;
          let enabledHiding = settings.hideByFilterRules;
          if (!enabledHiding) {
            await updateSettings({ hideByFilterRules: true });
            enabledHiding = true;
          }
          const value = message.kind === "handle"
            ? message.value.replace(/^@/, "").trim().toLowerCase()
            : message.value.normalize("NFKC").trim();
          return {
            ok: true,
            added: result.added,
            kind: message.kind,
            value,
            enabledHiding,
            status: filterRuleSetStatus(saved, enabledHiding),
          } satisfies QuickAddFilterRuleResponse;
        })
        .then((response) => sendResponse(response))
        .catch((error: unknown) => sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }));
      return true;
    }

    if (message.type === "filter-rules:status") {
      if (!sender.url?.startsWith("https://x.com/")) {
        sendResponse({ ok: false, error: "Filter rule status is available only to x.com" });
        return false;
      }
      void getSettings()
        .then(async (settings) => {
          const applying = settings.consentVersion >= CURRENT_CONSENT_VERSION &&
            settings.hideByFilterRules;
          const viewerHandle = message.viewerHandle ?? settings.viewerHandle;
          const [ruleSet, hideStats] = await Promise.all([
            getFilterRuleSet(viewerHandle),
            getHideStats(viewerHandle),
          ]);
          return { status: filterRuleSetStatus(ruleSet, applying), hideStats };
        })
        .then((payload) => sendResponse({
          ok: true,
          ...payload,
        } satisfies GetFilterRulesStatusResponse))
        .catch((error: unknown) => sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }));
      return true;
    }

    if (message.type === "hide-stats:increment") {
      if (!sender.url?.startsWith("https://x.com/")) {
        sendResponse({ ok: false, error: "Hide stats are accepted only from x.com" });
        return false;
      }
      void getSettings()
        .then(async (settings) => {
          if (settings.consentVersion < CURRENT_CONSENT_VERSION) {
            throw new Error("Observation consent is required");
          }
          const delta: HideStatsDelta = {};
          if (message.hiddenByRules) delta.hiddenByRules = message.hiddenByRules;
          if (message.hiddenByMuted) delta.hiddenByMuted = message.hiddenByMuted;
          if (message.hiddenByBlockedBy) delta.hiddenByBlockedBy = message.hiddenByBlockedBy;
          if (!hideStatsHaveIncrements(delta)) {
            return getHideStats(message.viewerHandle ?? settings.viewerHandle);
          }
          return incrementHideStats(delta, message.viewerHandle ?? settings.viewerHandle);
        })
        .then((hideStats) => sendResponse({
          ok: true,
          hideStats,
        } satisfies IncrementHideStatsResponse))
        .catch((error: unknown) => sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }));
      return true;
    }

    if (message.type === "sidepanel:open") {
      const tab = sender.tab;
      if (!sender.url?.startsWith("https://x.com/") || tab?.id === undefined) {
        sendResponse({ ok: false, error: "Side panel requests require an active x.com tab" });
        return false;
      }
      if (message.tab) void updateSettings({ sidePanelTab: message.tab });
      if (message.toggle && isTrackedSidePanelOpen(tab.windowId)) {
        void closeExtensionSidePanel(tab).then(
          () => {
            rememberSidePanelClosed(tab.windowId);
            sendResponse({ ok: true } satisfies OpenSidePanelResponse);
          },
          (error: unknown) => sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          } satisfies OpenSidePanelResponse),
        );
        return true;
      }
      void chrome.sidePanel.open({ tabId: tab.id }).then(
        () => {
          rememberSidePanelOpen(tab.windowId);
          sendResponse({ ok: true } satisfies OpenSidePanelResponse);
        },
        (error: unknown) => sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        } satisfies OpenSidePanelResponse),
      );
      return true;
    }

    if (message.type === "data:changed") {
      if (!sender.url?.startsWith(chrome.runtime.getURL(""))) {
        sendResponse({ ok: false, error: "Data changes are accepted only from extension pages" });
        return false;
      }
      void broadcastDataChanged(chrome.tabs)
        .then(() => sendResponse({ ok: true }))
        .catch((error: unknown) => sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }));
      return true;
    }

    return false;
  },
);

async function handleUpsert(
  message: UpsertObservationsMessage,
): Promise<UpsertObservationsResponse> {
  const settings = await getSettings();
  if (
    settings.consentVersion < CURRENT_CONSENT_VERSION ||
    !settings.observerEnabled
  ) {
    return { ok: true, users: [] };
  }
  const viewerHandle = message.viewerHandle?.toLowerCase() ?? null;
  if (viewerHandle) {
    if (settings.viewerHandle !== viewerHandle) {
      await updateSettings({ viewerHandle });
    }
    await deleteUserRecord(viewerHandle);
  }
  const users = await upsertObservations(
    message.observations.filter(
      (observation) =>
        observation.relationship !== "unknown" &&
        (!viewerHandle || observation.userKey !== viewerHandle),
    ),
  );
  void broadcastDataChanged(chrome.tabs).catch(() => undefined);
  return { ok: true, users };
}

async function openDashboard(message: OpenDashboardMessage): Promise<void> {
  const suffix = message.section === "filter-rules" ? "#filter-rules" : "";
  await chrome.tabs.create({ url: chrome.runtime.getURL(`dashboard.html${suffix}`) });
}

async function initializeActionState(): Promise<void> {
  const settings = await getSettings();
  await syncActionState(settings);
}

async function openConsentSurface(sidePanelOpen: Promise<void> | null): Promise<void> {
  if (sidePanelOpen) {
    try {
      await sidePanelOpen;
      return;
    } catch {
      // Fall through to the full local consent page.
    }
  }
  await chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
}

async function syncActionState(settings: ObserverSettings): Promise<void> {
  const presentation = actionPresentation(settings, resolveUiLocale(settings.uiLocale));
  await Promise.all([
    chrome.action.setBadgeText({ text: presentation.badgeText }),
    chrome.action.setBadgeBackgroundColor({ color: presentation.badgeColor }),
    chrome.action.setBadgeTextColor({ color: "#16221B" }),
    chrome.action.setTitle({ title: presentation.title }),
  ]);
}

async function syncExtensionUiState(settings: ObserverSettings): Promise<void> {
  await Promise.all([
    syncActionState(settings),
    syncConsentContextMenu(settings),
  ]);
}

async function syncExtensionUiStateFromStorage(settings: ObserverSettings): Promise<void> {
  try {
    await syncExtensionUiState(settings);
  } catch {
    // A later storage change or service-worker start will retry the presentation sync.
  }
}

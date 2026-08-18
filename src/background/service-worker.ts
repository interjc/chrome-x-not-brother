import type {
  GetSummaryResponse,
  LookupUsersResponse,
  OpenDashboardMessage,
  OpenSidePanelResponse,
  RuntimeMessage,
  UpsertObservationsMessage,
  UpsertObservationsResponse,
} from "../domain/messages";
import type { ObserverSettings } from "../domain/types";
import { getExtensionLocale } from "../i18n";
import { actionPresentation } from "./action-state";
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
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  getSettings,
  updateSettings,
} from "../storage/settings";

chrome.runtime.onInstalled.addListener(async (details) => {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  if (!stored[SETTINGS_KEY]) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
  }
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  await purgeUnknownObservations();
  const settings = await getSettings();
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  await syncActionState(settings);
  if (details.reason === "install") {
    await chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html?welcome=1") });
  }
});

void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
void purgeUnknownObservations();
void getSettings().then(async (settings) => {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  await syncActionState(settings);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[SETTINGS_KEY]) return;
  const next = {
    ...DEFAULT_SETTINGS,
    ...(changes[SETTINGS_KEY].newValue as Partial<ObserverSettings> | undefined),
  };
  void syncActionState(next);
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

    if (message.type === "sidepanel:open") {
      if (!sender.url?.startsWith("https://x.com/") || sender.tab?.id === undefined) {
        sendResponse({ ok: false, error: "Side panel requests require an active x.com tab" });
        return false;
      }
      void chrome.sidePanel.open({ tabId: sender.tab.id }).then(
        () => sendResponse({ ok: true } satisfies OpenSidePanelResponse),
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

async function openDashboard(_message: OpenDashboardMessage): Promise<void> {
  await chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
}

async function syncActionState(settings: ObserverSettings): Promise<void> {
  const presentation = actionPresentation(settings, getExtensionLocale());
  await Promise.all([
    chrome.action.setBadgeText({ text: presentation.badgeText }),
    chrome.action.setBadgeBackgroundColor({ color: presentation.badgeColor }),
    chrome.action.setBadgeTextColor({ color: "#16221B" }),
    chrome.action.setTitle({ title: presentation.title }),
  ]);
}

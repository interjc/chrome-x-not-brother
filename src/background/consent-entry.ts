import type { ObserverSettings } from "../domain/types";
import { resolveUiLocale, translate, type AppLocale } from "../i18n";
import { CURRENT_CONSENT_VERSION } from "../storage/settings";

export const CONSENT_CONTEXT_MENU_ID = "not-brother-review-consent";

export function consentContextMenuPresentation(
  settings: ObserverSettings,
  locale: AppLocale,
): { title: string; visible: boolean } {
  return {
    title: translate(locale, "actionConsentMenu"),
    visible: settings.consentVersion < CURRENT_CONSENT_VERSION,
  };
}

function createConsentContextMenu(
  presentation: ReturnType<typeof consentContextMenuPresentation>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.contextMenus.create({
      id: CONSENT_CONTEXT_MENU_ID,
      contexts: ["action"],
      ...presentation,
    }, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

export async function syncConsentContextMenu(settings: ObserverSettings): Promise<void> {
  const presentation = consentContextMenuPresentation(
    settings,
    resolveUiLocale(settings.uiLocale),
  );
  try {
    await chrome.contextMenus.update(CONSENT_CONTEXT_MENU_ID, presentation);
  } catch {
    await createConsentContextMenu(presentation);
  }
}

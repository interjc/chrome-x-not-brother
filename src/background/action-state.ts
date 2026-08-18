import type { ObserverSettings } from "../domain/types";
import { translate, type AppLocale } from "../i18n";
import { CURRENT_CONSENT_VERSION } from "../storage/settings";

export interface ActionPresentation {
  badgeText: "ON" | "!";
  badgeColor: string;
  title: string;
}

export function actionPresentation(
  settings: ObserverSettings,
  locale: AppLocale,
): ActionPresentation {
  const hasConsent = settings.consentVersion >= CURRENT_CONSENT_VERSION;
  const active = hasConsent && settings.observerEnabled;
  return {
    badgeText: active ? "ON" : "!",
    badgeColor: active ? "#C9ED67" : hasConsent ? "#8A938D" : "#E9A83A",
    title: translate(
      locale,
      active ? "actionActiveTitle" : hasConsent ? "actionPausedTitle" : "actionSetupTitle",
    ),
  };
}

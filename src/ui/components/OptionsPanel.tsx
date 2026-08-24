import type { ObserverSettings } from "../../domain/types";
import { translate, type AppLocale, type MessageKey } from "../../i18n";
import { LanguageSwitch } from "./LanguageSwitch";
import { TimelineFilterSettings } from "./TimelineFilterSettings";

export function OptionsPanel({
  settings,
  settingsReady,
  locale,
  note,
  onChange,
}: {
  settings: ObserverSettings;
  settingsReady: boolean;
  locale: AppLocale;
  note?: MessageKey;
  onChange: <Key extends keyof ObserverSettings>(
    key: Key,
    value: ObserverSettings[Key],
  ) => void;
}) {
  const t = (key: MessageKey) => translate(locale, key);

  return (
    <section className="options-panel" aria-labelledby="options-heading">
      <p className="eyebrow">{t("optionsEyebrow")}</p>
      <h1 id="options-heading">{t("optionsHeading")}</h1>
      <p>{t("optionsIntro")}</p>
      <div className="options-panel__locale">
        <LanguageSwitch
          disabled={!settingsReady}
          locale={locale}
          value={settings.uiLocale}
          onChange={(uiLocale) => onChange("uiLocale", uiLocale)}
        />
      </div>
      <label className="options-panel__toggle">
        <input
          checked={settings.showBadges}
          disabled={!settingsReady}
          onChange={(event) => onChange("showBadges", event.target.checked)}
          type="checkbox"
        />
        <i />
        <strong>{t("showPageBadges")}</strong>
      </label>
      <TimelineFilterSettings
        detailed
        disabled={!settingsReady}
        locale={locale}
        onChange={onChange}
        settings={settings}
      />
      <p className="options-panel__note">{t(note ?? "optionsNote")}</p>
    </section>
  );
}

import { UI_LOCALE_PREFERENCES, type UiLocalePreference } from "../../domain/types";
import {
  translate,
  type AppLocale,
  type MessageKey,
} from "../../i18n";

const OPTION_KEYS: Record<UiLocalePreference, MessageKey> = {
  auto: "languageFollowBrowser",
  en: "languageEnglish",
  ja: "languageJapanese",
  "zh-CN": "languageChinese",
};

export function LanguageSwitch({
  value,
  locale,
  disabled = false,
  onChange,
}: {
  value: UiLocalePreference;
  locale: AppLocale;
  disabled?: boolean;
  onChange: (value: UiLocalePreference) => void;
}) {
  return (
    <label className="language-switch">
      <span>{translate(locale, "languageLabel")}</span>
      <select
        aria-label={translate(locale, "languageAria")}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value as UiLocalePreference)}
      >
        {UI_LOCALE_PREFERENCES.map((preference) => (
          <option key={preference} value={preference}>
            {translate(locale, OPTION_KEYS[preference])}
          </option>
        ))}
      </select>
    </label>
  );
}

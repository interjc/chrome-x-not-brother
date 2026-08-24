import type { ObserverSettings } from "../../domain/types";
import { translate, type AppLocale, type MessageKey } from "../../i18n";

const FILTERS = [
  {
    key: "hideMutedAccounts",
    label: "hideMutedAccountsLabel",
    description: "hideMutedAccountsDescription",
  },
  {
    key: "hideBlockedByAccounts",
    label: "hideBlockedByAccountsLabel",
    description: "hideBlockedByAccountsDescription",
  },
] as const;

export function TimelineFilterSettings({
  settings,
  disabled = false,
  locale,
  detailed = false,
  onChange,
}: {
  settings: ObserverSettings;
  disabled?: boolean;
  locale: AppLocale;
  detailed?: boolean;
  onChange: <Key extends keyof ObserverSettings>(
    key: Key,
    value: ObserverSettings[Key],
  ) => void;
}) {
  const t = (key: MessageKey) => translate(locale, key);

  return (
    <div className={`timeline-filters${detailed ? " timeline-filters--detailed" : ""}`}>
      <span>{t("timelineFiltersHeading")}</span>
      {FILTERS.map((item) => (
        <label key={item.key} title={t(item.description)}>
          <input
            checked={settings[item.key]}
            disabled={disabled}
            onChange={(event) => onChange(item.key, event.target.checked)}
            type="checkbox"
          />
          <i />
          <span>
            <strong>{t(item.label)}</strong>
            {detailed ? <small>{t(item.description)}</small> : null}
          </span>
        </label>
      ))}
    </div>
  );
}

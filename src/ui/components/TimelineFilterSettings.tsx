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
  {
    key: "hideByFilterRules",
    label: "hideByFilterRulesLabel",
    description: "hideByFilterRulesDescription",
  },
] as const;

export function TimelineFilterSettings({
  settings,
  disabled = false,
  locale,
  detailed = false,
  onEditFilterRules,
  onChange,
}: {
  settings: ObserverSettings;
  disabled?: boolean;
  locale: AppLocale;
  detailed?: boolean;
  onEditFilterRules?: () => void;
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
        <div className="timeline-filters__item" key={item.key}>
          <label title={t(item.description)}>
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
          {item.key === "hideByFilterRules" && onEditFilterRules ? (
            <button
              className="timeline-filters__edit-rules"
              type="button"
              onClick={onEditFilterRules}
            >
              {t("editFilterRules")}
              <span aria-hidden="true">↗</span>
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

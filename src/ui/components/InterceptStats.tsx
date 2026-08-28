import type { FilterRuleSetStatus } from "../../domain/filter-rule-matching";
import type { HideStats } from "../../domain/hide-stats";
import { translate, type AppLocale, type MessageKey } from "../../i18n";

const ITEMS = [
  {
    key: "active",
    label: "interceptActiveRules",
    tone: "tone-rules",
  },
  {
    key: "rules",
    label: "interceptHiddenByRules",
    tone: "tone-rules",
  },
  {
    key: "muted",
    label: "interceptHiddenByMuted",
    tone: "tone-muted",
  },
  {
    key: "blockedBy",
    label: "interceptHiddenByBlockedBy",
    tone: "tone-blocked",
  },
] as const;

export function InterceptStats({
  locale,
  status,
  stats,
  variant = "strip",
  onOpenRules,
}: {
  locale: AppLocale;
  status: FilterRuleSetStatus | null;
  stats: HideStats;
  variant?: "strip" | "mini" | "header";
  onOpenRules?: () => void;
}) {
  const t = (key: MessageKey, values?: Record<string, string | number>) =>
    translate(locale, key, values);
  const values = {
    active: status?.activeRuleCount ?? 0,
    rules: stats.hiddenByRules,
    muted: stats.hiddenByMuted,
    blockedBy: stats.hiddenByBlockedBy,
  };
  const counts = ITEMS.map((item) => ({
    ...item,
    count: values[item.key].toLocaleString(locale),
  }));

  if (variant === "header") {
    return (
      <p className="filter-rules-manager__stats">
        {counts.map((item) => `${t(item.label)} ${item.count}`).join(" · ")}
      </p>
    );
  }

  if (variant === "mini") {
    const body = (
      <>
        <div>
          <strong>{t("sideInterceptTitle")}</strong>
          <span>{t("sideInterceptHint")}</span>
        </div>
        <dl>
          {counts.map((item) => (
            <div key={item.key}>
              <dt>{t(item.label)}</dt>
              <dd>{item.count}</dd>
            </div>
          ))}
        </dl>
      </>
    );
    if (!onOpenRules) {
      return <section aria-label={t("interceptStatsAria")} className="intercept-callout">{body}</section>;
    }
    return (
      <button
        aria-label={t("interceptStatsAria")}
        className="intercept-callout intercept-callout--button"
        onClick={onOpenRules}
        type="button"
      >
        {body}
      </button>
    );
  }

  return (
    <section aria-label={t("interceptStatsAria")} className="stats-strip stats-strip--intercept">
      {counts.map((item) => (
        <article className={item.tone} key={item.key}>
          <span>HIDE</span>
          <strong>{item.count}</strong>
          <small>{t(item.label)}</small>
        </article>
      ))}
    </section>
  );
}

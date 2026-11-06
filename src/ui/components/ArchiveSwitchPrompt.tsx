import { useState } from "react";
import { translate, type AppLocale } from "../../i18n";
import { LEGACY_VIEWER, type ArchiveScope } from "../../storage/database";
import { Icon } from "./Icon";

const MAX_SOURCES = 3;

/** Other accounts' archives the current account could start from. */
export function archiveSwitchSources(
  scopes: readonly ArchiveScope[],
  viewer: string | null,
  dismissed: readonly string[],
  currentUserCount: number,
): ArchiveScope[] {
  if (!viewer || currentUserCount > 0 || dismissed.includes(viewer)) return [];
  return scopes
    .filter((scope) => scope.viewer !== viewer && scope.viewer !== LEGACY_VIEWER)
    .slice(0, MAX_SOURCES);
}

export function ArchiveSwitchPrompt({
  locale,
  viewer,
  sources,
  onCopy,
  onStartEmpty,
}: {
  locale: AppLocale;
  viewer: string;
  sources: readonly ArchiveScope[];
  onCopy: (from: string) => Promise<void>;
  onStartEmpty: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const t = (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) =>
    translate(locale, key, values);

  async function run(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="archive-switch" aria-labelledby="archive-switch-title">
      <h2 id="archive-switch-title">{t("switchPromptTitle", { handle: viewer })}</h2>
      <p>{t("switchPromptBody", { handle: viewer })}</p>
      <div className="archive-switch__actions">
        {sources.map((source) => (
          <button
            className="primary-button"
            disabled={busy}
            key={source.viewer}
            onClick={() => void run(() => onCopy(source.viewer))}
            type="button"
          >
            <Icon name="database" />
            {t("switchPromptCopy", {
              from: source.viewer,
              count: source.userCount.toLocaleString(locale),
            })}
          </button>
        ))}
        <button
          className="archive-switch__fresh"
          disabled={busy}
          onClick={() => void run(onStartEmpty)}
          type="button"
        >
          {t("switchPromptFresh")}
        </button>
      </div>
    </section>
  );
}

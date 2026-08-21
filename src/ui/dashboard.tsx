import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/newsreader";
import "./styles.css";

import type { CSSProperties, ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { PROJECT_FEEDBACK_URL } from "../domain/project";
import { profileUrlForHandle, visibleDisplayName } from "../domain/identity";
import { displayRelationship, isDisplayedUser } from "../domain/relationships";
import { parseDatabaseExport, usersToCsv } from "../domain/export";
import type { ObservationRecord, RelationshipKind, UserRecord } from "../domain/types";
import {
  resolveUiLocale,
  relationshipPresentation,
  sourceTypeLabel,
  translate,
  type AppLocale,
  type MessageKey,
} from "../i18n";
import {
  acknowledgeRelationshipChange,
  clearDatabase,
  db,
  deleteUserRecord,
  exportDatabase,
  importDatabase,
} from "../storage/database";
import { Avatar } from "./components/Avatar";
import { Brand } from "./components/Brand";
import { Icon } from "./components/Icon";
import { LanguageSwitch } from "./components/LanguageSwitch";
import { RelationshipPill } from "./components/RelationshipPill";
import { absoluteTime, downloadFile, relativeTime } from "./format";
import { useObserverSettings, useUsers } from "./hooks";
import { CURRENT_CONSENT_VERSION } from "../storage/settings";

type Filter = "all" | "changed" | Exclude<RelationshipKind, "unknown" | "none">;
type Sort = "recent" | "handle" | "observations";

const extensionVersion = chrome.runtime.getManifest?.().version ?? "dev";

function t(
  locale: AppLocale,
  key: MessageKey,
  values?: Record<string, string | number>,
) {
  return translate(locale, key, values);
}

function filterOptions(locale: AppLocale): { key: Filter; label: string }[] {
  return [
    { key: "all", label: t(locale, "filterAll") },
    { key: "changed", label: relationshipPresentation(locale, "changed").label },
    { key: "mutual", label: relationshipPresentation(locale, "mutual").label },
    { key: "following_only", label: relationshipPresentation(locale, "following_only").label },
    { key: "follows_you_only", label: relationshipPresentation(locale, "follows_you_only").label },
    { key: "blocked_by", label: relationshipPresentation(locale, "blocked_by").label },
  ];
}

async function notifyDataChanged(): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: "data:changed" });
  } catch {
    // The local mutation already succeeded; open X tabs can recover on reload.
  }
}

function countFor(users: UserRecord[], filter: Filter): number {
  if (filter === "all") return users.length;
  if (filter === "changed") return users.filter((user) => user.hasChanged).length;
  return users.filter((user) => user.currentRelationship === filter).length;
}

function UserHistory({ userKey, locale }: { userKey: string; locale: AppLocale }) {
  const [items, setItems] = useState<ObservationRecord[] | null>(null);

  useEffect(() => {
    setItems(null);
    void db.observations
      .where("userKey")
      .equals(userKey)
      .toArray()
      .then((records) => setItems(records.toSorted((a, b) => b.observedAt - a.observedAt)));
  }, [userKey]);

  if (items === null) {
    return <p className="history-loading">{t(locale, "historyLoading")}</p>;
  }

  return (
    <div className="history-list">
      {items.length === 0 ? <p>{t(locale, "historyEmpty")}</p> : null}
      {items.slice(0, 30).map((item) => (
        <div className="history-item" key={item.id ?? `${item.userKey}-${item.observedAt}`}>
          <time>{absoluteTime(item.observedAt, locale)}</time>
          <RelationshipPill relationship={item.relationship} locale={locale} />
          <span>{sourceTypeLabel(locale, item.sourceType)}</span>
          <a href={item.sourceUrl} target="_blank" rel="noreferrer" title={t(locale, "openObservationSource")}>
            <Icon name="external" />
          </a>
        </div>
      ))}
    </div>
  );
}

function Dashboard() {
  const { users: observedUsers, loading: usersLoading } = useUsers();
  const { settings, settingsReady, setSettings, setSetting } = useObserverSettings();
  const locale = resolveUiLocale(settings.uiLocale);
  const users = settingsReady
    ? observedUsers.filter((user) =>
      user.key !== settings.viewerHandle && isDisplayedUser(user),
    )
    : [];
  const loading = usersLoading || !settingsReady;
  const hasConsent = settings.consentVersion >= CURRENT_CONSENT_VERSION;
  const filters = filterOptions(locale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = t(locale, "dashboardTitle");
  }, [locale]);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [query, setQuery] = useState("");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const isWelcome = new URLSearchParams(window.location.search).get("welcome") === "1";

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInput.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const visibleUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const result = users.filter((user) => {
      const filterMatches =
        filter === "all" ||
        (filter === "changed" ? user.hasChanged : user.currentRelationship === filter);
      const queryMatches =
        !normalizedQuery ||
        user.handle.toLowerCase().includes(normalizedQuery) ||
        user.displayName?.toLowerCase().includes(normalizedQuery);
      return filterMatches && queryMatches;
    });
    return result.toSorted((a, b) => {
      if (sort === "handle") return a.handle.localeCompare(b.handle);
      if (sort === "observations") return b.observationCount - a.observationCount;
      return b.lastSeenAt - a.lastSeenAt;
    });
  }, [filter, query, sort, users]);

  async function exportJson(): Promise<void> {
    const payload = await exportDatabase(settings.viewerHandle);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`not-brother-${stamp}.json`, JSON.stringify(payload, null, 2), "application/json");
    setNotice(t(locale, "exportJsonSuccess"));
  }

  function exportCsv(): void {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`not-brother-${stamp}.csv`, `\uFEFF${usersToCsv(users, locale)}`, "text/csv;charset=utf-8");
    setNotice(t(locale, "exportCsvSuccess"));
  }

  async function importJson(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const payload = parseDatabaseExport(JSON.parse(await file.text()) as unknown);
      await importDatabase(payload);
      if (settings.viewerHandle) await deleteUserRecord(settings.viewerHandle);
      await notifyDataChanged();
      setNotice(t(locale, "importSuccess", { count: payload.users.length }));
    } catch {
      setNotice(t(locale, "importFailed"));
    }
  }

  async function clearEverything(): Promise<void> {
    if (!window.confirm(t(locale, "clearConfirm"))) return;
    await clearDatabase();
    await notifyDataChanged();
    setNotice(t(locale, "clearSuccess"));
  }

  async function deleteOne(user: UserRecord): Promise<void> {
    if (!window.confirm(t(locale, "deleteConfirm", { handle: user.handle }))) return;
    await deleteUserRecord(user.key);
    await notifyDataChanged();
    setNotice(t(locale, "deleteSuccess", { handle: user.handle }));
  }

  async function acknowledgeChange(userKey: string): Promise<void> {
    await acknowledgeRelationshipChange(userKey);
    await notifyDataChanged();
  }

  async function enableObserver(): Promise<void> {
    await setSettings({
      consentVersion: CURRENT_CONSENT_VERSION,
      observerEnabled: true,
    });
    setNotice(t(locale, "observerStarted"));
  }

  return (
    <main className="app app--dashboard">
      <header className="dashboard-header">
        <Brand locale={locale} />
        <div className="dashboard-header__tools">
          <span className={`observer-state${settings.observerEnabled ? " is-on" : ""}`}>
            <i />{t(locale, settings.observerEnabled ? "observerRunning" : "observerPaused")}
          </span>
          <button className="icon-button" title={t(locale, "importJson")} aria-label={t(locale, "importJson")} onClick={() => importInput.current?.click()}><Icon name="upload" /></button>
          <input ref={importInput} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void importJson(event)} />
          <button className="icon-button" title={t(locale, "exportJson")} aria-label={t(locale, "exportJson")} onClick={() => void exportJson()}><Icon name="download" /></button>
        </div>
      </header>

      <section className="hero">
        <div className="hero__copy">
          <p className="eyebrow">{t(locale, "fieldbookEyebrow")}</p>
          <h1>{t(locale, "heroTitleBefore")}<br /><em>{t(locale, "heroTitleAfter")}</em></h1>
        </div>
        <div className="hero__note">
          <span>{t(locale, "productRuleLabel")}</span>
          <p>{t(locale, "productRuleBody")}</p>
        </div>
      </section>

      {settingsReady && !hasConsent ? (
        <section className="dashboard-consent" aria-labelledby="dashboard-consent-title">
          <div>
            <span>{t(locale, isWelcome ? "installComplete" : "consentRequired")}</span>
            <h2 id="dashboard-consent-title">
              {t(locale, isWelcome ? "welcomeTitle" : "notStartedTitle")}
            </h2>
            <p>{t(locale, "dashboardConsentBody")}</p>
          </div>
          <button type="button" onClick={() => void enableObserver()}>
            {t(locale, "agreeStart")}
            <Icon name="chevron" />
          </button>
        </section>
      ) : null}

      <section className="stats-strip" aria-label={t(locale, "archiveStatsAria")}>
        <article><span>OBSERVED</span><strong>{loading ? "—" : users.length.toLocaleString(locale)}</strong><small>{t(locale, "statObserved")}</small></article>
        <article className="tone-following"><span>ONE-WAY</span><strong>{countFor(users, "following_only")}</strong><small>{t(locale, "statFollowingOnly")}</small></article>
        <article className="tone-blocked"><span>BLOCKED BY</span><strong>{countFor(users, "blocked_by")}</strong><small>{t(locale, "statBlockedBy")}</small></article>
        <article className="tone-changed"><span>CHANGED</span><strong>{countFor(users, "changed")}</strong><small>{t(locale, "statChanged")}</small></article>
      </section>

      <div className="fieldbook-layout">
        <aside className="filter-rail">
          <div className="filter-rail__heading"><span>INDEX</span><strong>{t(locale, "relationshipIndex")}</strong></div>
          <nav aria-label={t(locale, "relationshipFilterAria")}>
            {filters.map((item, index) => (
              <button className={filter === item.key ? "is-active" : ""} key={item.key} onClick={() => setFilter(item.key)}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{item.label}</strong>
                <em>{countFor(users, item.key)}</em>
              </button>
            ))}
          </nav>
          <div className="local-settings">
            <span>{t(locale, "localControls")}</span>
            <label><input type="checkbox" disabled={!settingsReady || !hasConsent} checked={settings.observerEnabled} onChange={(event) => void setSetting("observerEnabled", event.target.checked)} /><i />{t(locale, "annotateAndCollect")}</label>
            <label><input type="checkbox" checked={settings.showBadges} onChange={(event) => void setSetting("showBadges", event.target.checked)} /><i />{t(locale, "showPageBadges")}</label>
            <LanguageSwitch
              disabled={!settingsReady}
              locale={locale}
              value={settings.uiLocale}
              onChange={(uiLocale) => void setSetting("uiLocale", uiLocale)}
            />
          </div>
        </aside>

        <section className="records-panel">
          <div className="records-toolbar">
            <label className="search-box">
              <Icon name="search" />
              <input ref={searchInput} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t(locale, "searchPlaceholder")} />
              <kbd>⌘ K</kbd>
            </label>
            <label className="sort-box">{t(locale, "sortLabel")}
              <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
                <option value="recent">{t(locale, "sortRecent")}</option>
                <option value="handle">{t(locale, "sortHandle")}</option>
                <option value="observations">{t(locale, "sortObservations")}</option>
              </select>
              <Icon name="chevron" />
            </label>
            <div className="export-menu">
              <button onClick={exportCsv}><Icon name="download" />CSV</button>
              <button onClick={() => void exportJson()}><Icon name="archive" />JSON</button>
              <button className="danger-text" title={t(locale, "clearLocalData")} onClick={() => void clearEverything()}><Icon name="trash" /></button>
            </div>
          </div>

          <div className="records-meta">
            <p>{t(locale, "matchingRecords", { count: visibleUsers.length })}</p>
            <p>{t(locale, "recentlyRefreshed")} <span>{users[0] ? relativeTime(users[0].lastSeenAt, locale) : t(locale, "neverObserved")}</span></p>
          </div>

          <div className="record-list">
            {!loading && visibleUsers.length === 0 ? (
              <div className="dashboard-empty"><Icon name="eye" /><h2>{t(locale, "emptyDashboardTitle")}</h2><p>{t(locale, "emptyDashboardBody")}</p></div>
            ) : null}
            {visibleUsers.map((user, index) => {
              const display = displayRelationship(user);
              const expanded = expandedUser === user.key;
              return (
                <article
                  className={`user-record user-record--${display}`}
                  key={user.key}
                  style={{ "--row-index": Math.min(index, 12) } as CSSProperties}
                >
                  <div className="user-record__number">{String(index + 1).padStart(3, "0")}</div>
                  <a
                    aria-label={t(locale, "openProfileAria", { handle: user.handle })}
                    className="user-record__person"
                    href={profileUrlForHandle(user.handle)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <Avatar avatarUrl={user.avatarUrl} displayName={user.displayName} handle={user.handle} />
                    <span className="user-record__identity">
                      <strong>{visibleDisplayName(user.displayName, user.handle)}</strong>
                      <span translate="no">@{user.handle}<Icon name="external" /></span>
                    </span>
                  </a>
                  <div className="user-record__relationship">
                    <RelationshipPill relationship={display} locale={locale} />
                    {user.hasChanged && user.previousRelationship ? (
                      <small>{relationshipPresentation(locale, user.previousRelationship).shortLabel} → {relationshipPresentation(locale, user.currentRelationship).shortLabel}</small>
                    ) : <small>{relationshipPresentation(locale, user.currentRelationship).description}</small>}
                  </div>
                  <div className="user-record__observation">
                    <span><Icon name="clock" />{relativeTime(user.lastSeenAt, locale)}</span>
                    <small>{t(locale, "observationCount", { count: user.observationCount, source: sourceTypeLabel(locale, user.lastSourceType) })}</small>
                  </div>
                  <div className="user-record__actions">
                    {user.hasChanged ? <button title={t(locale, "acknowledgeChangeTitle")} aria-label={t(locale, "acknowledgeChangeAria")} onClick={() => void acknowledgeChange(user.key)}><Icon name="check" /></button> : null}
                    <button title={t(locale, "viewHistoryTitle")} aria-label={t(locale, "viewHistoryAria")} className={expanded ? "is-active" : ""} onClick={() => setExpandedUser(expanded ? null : user.key)}><Icon name="history" /></button>
                    <button title={t(locale, "deleteRecordTitle")} aria-label={t(locale, "deleteRecordAria")} onClick={() => void deleteOne(user)}><Icon name="trash" /></button>
                  </div>
                  {expanded ? <div className="user-record__history"><UserHistory userKey={user.key} locale={locale} /></div> : null}
                </article>
              );
            })}
          </div>
        </section>
      </div>

      {notice ? <button className="toast" onClick={() => setNotice(null)}>{notice}<span>×</span></button> : null}
      <footer className="dashboard-footer">
        <Brand compact locale={locale} />
        <p>{t(locale, "localOnlyFooter")}</p>
        <a
          aria-label={t(locale, "sendFeedbackAria")}
          className="dashboard-footer__feedback"
          href={PROJECT_FEEDBACK_URL}
          rel="noreferrer"
          target="_blank"
        >
          {t(locale, "sendFeedback")}
        </a>
        <p>{t(locale, "brandName")} {extensionVersion}</p>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Dashboard />);

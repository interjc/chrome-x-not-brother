import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/newsreader";
import "./styles.css";

import type { CSSProperties, ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { PROJECT_FEEDBACK_URL } from "../domain/project";
import { displayRelationship } from "../domain/relationships";
import { parseDatabaseExport, usersToCsv } from "../domain/export";
import type { ObservationRecord, RelationshipKind, UserRecord } from "../domain/types";
import {
  getExtensionLocale,
  relationshipPresentation,
  sourceTypeLabel,
  translate,
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
import { RelationshipPill } from "./components/RelationshipPill";
import { absoluteTime, downloadFile, relativeTime } from "./format";
import { useObserverSettings, useUsers } from "./hooks";
import { CURRENT_CONSENT_VERSION } from "../storage/settings";

type Filter = "all" | "changed" | Exclude<RelationshipKind, "unknown">;
type Sort = "recent" | "handle" | "observations";

const locale = getExtensionLocale();
const t = (key: MessageKey, values?: Record<string, string | number>) =>
  translate(locale, key, values);
const extensionVersion = chrome.runtime.getManifest?.().version ?? "dev";
document.documentElement.lang = locale;
document.title = t("dashboardTitle");

const filters: { key: Filter; label: string }[] = [
  { key: "all", label: t("filterAll") },
  { key: "changed", label: relationshipPresentation(locale, "changed").label },
  { key: "mutual", label: relationshipPresentation(locale, "mutual").label },
  { key: "following_only", label: relationshipPresentation(locale, "following_only").label },
  { key: "follows_you_only", label: relationshipPresentation(locale, "follows_you_only").label },
  { key: "blocked_by", label: relationshipPresentation(locale, "blocked_by").label },
];

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

function UserHistory({ userKey }: { userKey: string }) {
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
    return <p className="history-loading">{t("historyLoading")}</p>;
  }

  return (
    <div className="history-list">
      {items.length === 0 ? <p>{t("historyEmpty")}</p> : null}
      {items.slice(0, 30).map((item) => (
        <div className="history-item" key={item.id ?? `${item.userKey}-${item.observedAt}`}>
          <time>{absoluteTime(item.observedAt, locale)}</time>
          <RelationshipPill relationship={item.relationship} locale={locale} />
          <span>{sourceTypeLabel(locale, item.sourceType)}</span>
          <a href={item.sourceUrl} target="_blank" rel="noreferrer" title={t("openObservationSource")}>
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
  const users = settingsReady
    ? observedUsers.filter((user) =>
      user.key !== settings.viewerHandle && user.currentRelationship !== "unknown",
    )
    : [];
  const loading = usersLoading || !settingsReady;
  const hasConsent = settings.consentVersion >= CURRENT_CONSENT_VERSION;
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
    setNotice(t("exportJsonSuccess"));
  }

  function exportCsv(): void {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`not-brother-${stamp}.csv`, `\uFEFF${usersToCsv(users, locale)}`, "text/csv;charset=utf-8");
    setNotice(t("exportCsvSuccess"));
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
      setNotice(t("importSuccess", { count: payload.users.length }));
    } catch {
      setNotice(t("importFailed"));
    }
  }

  async function clearEverything(): Promise<void> {
    if (!window.confirm(t("clearConfirm"))) return;
    await clearDatabase();
    await notifyDataChanged();
    setNotice(t("clearSuccess"));
  }

  async function deleteOne(user: UserRecord): Promise<void> {
    if (!window.confirm(t("deleteConfirm", { handle: user.handle }))) return;
    await deleteUserRecord(user.key);
    await notifyDataChanged();
    setNotice(t("deleteSuccess", { handle: user.handle }));
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
    setNotice(t("observerStarted"));
  }

  return (
    <main className="app app--dashboard">
      <header className="dashboard-header">
        <Brand locale={locale} />
        <div className="dashboard-header__tools">
          <span className={`observer-state${settings.observerEnabled ? " is-on" : ""}`}>
            <i />{t(settings.observerEnabled ? "observerRunning" : "observerPaused")}
          </span>
          <button className="icon-button" title={t("importJson")} aria-label={t("importJson")} onClick={() => importInput.current?.click()}><Icon name="upload" /></button>
          <input ref={importInput} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void importJson(event)} />
          <button className="icon-button" title={t("exportJson")} aria-label={t("exportJson")} onClick={() => void exportJson()}><Icon name="download" /></button>
        </div>
      </header>

      <section className="hero">
        <div className="hero__copy">
          <p className="eyebrow">{t("fieldbookEyebrow")}</p>
          <h1>{t("heroTitleBefore")}<br /><em>{t("heroTitleAfter")}</em></h1>
        </div>
        <div className="hero__note">
          <span>{t("productRuleLabel")}</span>
          <p>{t("productRuleBody")}</p>
        </div>
      </section>

      {settingsReady && !hasConsent ? (
        <section className="dashboard-consent" aria-labelledby="dashboard-consent-title">
          <div>
            <span>{t(isWelcome ? "installComplete" : "consentRequired")}</span>
            <h2 id="dashboard-consent-title">
              {t(isWelcome ? "welcomeTitle" : "notStartedTitle")}
            </h2>
            <p>{t("dashboardConsentBody")}</p>
          </div>
          <button type="button" onClick={() => void enableObserver()}>
            {t("agreeStart")}
            <Icon name="chevron" />
          </button>
        </section>
      ) : null}

      <section className="stats-strip" aria-label={t("archiveStatsAria")}>
        <article><span>OBSERVED</span><strong>{loading ? "—" : users.length.toLocaleString(locale)}</strong><small>{t("statObserved")}</small></article>
        <article className="tone-following"><span>ONE-WAY</span><strong>{countFor(users, "following_only")}</strong><small>{t("statFollowingOnly")}</small></article>
        <article className="tone-blocked"><span>BLOCKED BY</span><strong>{countFor(users, "blocked_by")}</strong><small>{t("statBlockedBy")}</small></article>
        <article className="tone-changed"><span>CHANGED</span><strong>{countFor(users, "changed")}</strong><small>{t("statChanged")}</small></article>
      </section>

      <div className="fieldbook-layout">
        <aside className="filter-rail">
          <div className="filter-rail__heading"><span>INDEX</span><strong>{t("relationshipIndex")}</strong></div>
          <nav aria-label={t("relationshipFilterAria")}>
            {filters.map((item, index) => (
              <button className={filter === item.key ? "is-active" : ""} key={item.key} onClick={() => setFilter(item.key)}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{item.label}</strong>
                <em>{countFor(users, item.key)}</em>
              </button>
            ))}
          </nav>
          <div className="local-settings">
            <span>{t("localControls")}</span>
            <label><input type="checkbox" disabled={!settingsReady || !hasConsent} checked={settings.observerEnabled} onChange={(event) => void setSetting("observerEnabled", event.target.checked)} /><i />{t("annotateAndCollect")}</label>
            <label><input type="checkbox" checked={settings.showBadges} onChange={(event) => void setSetting("showBadges", event.target.checked)} /><i />{t("showPageBadges")}</label>
          </div>
        </aside>

        <section className="records-panel">
          <div className="records-toolbar">
            <label className="search-box">
              <Icon name="search" />
              <input ref={searchInput} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchPlaceholder")} />
              <kbd>⌘ K</kbd>
            </label>
            <label className="sort-box">{t("sortLabel")}
              <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
                <option value="recent">{t("sortRecent")}</option>
                <option value="handle">{t("sortHandle")}</option>
                <option value="observations">{t("sortObservations")}</option>
              </select>
              <Icon name="chevron" />
            </label>
            <div className="export-menu">
              <button onClick={exportCsv}><Icon name="download" />CSV</button>
              <button onClick={() => void exportJson()}><Icon name="archive" />JSON</button>
              <button className="danger-text" title={t("clearLocalData")} onClick={() => void clearEverything()}><Icon name="trash" /></button>
            </div>
          </div>

          <div className="records-meta">
            <p>{t("matchingRecords", { count: visibleUsers.length })}</p>
            <p>{t("recentlyRefreshed")} <span>{users[0] ? relativeTime(users[0].lastSeenAt, locale) : t("neverObserved")}</span></p>
          </div>

          <div className="record-list">
            {!loading && visibleUsers.length === 0 ? (
              <div className="dashboard-empty"><Icon name="eye" /><h2>{t("emptyDashboardTitle")}</h2><p>{t("emptyDashboardBody")}</p></div>
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
                  <Avatar avatarUrl={user.avatarUrl} displayName={user.displayName} handle={user.handle} />
                  <div className="user-record__identity">
                    <strong>{user.displayName ?? `@${user.handle}`}</strong>
                    <a href={user.profileUrl} target="_blank" rel="noreferrer">@{user.handle}<Icon name="external" /></a>
                  </div>
                  <div className="user-record__relationship">
                    <RelationshipPill relationship={display} locale={locale} />
                    {user.hasChanged && user.previousRelationship ? (
                      <small>{relationshipPresentation(locale, user.previousRelationship).shortLabel} → {relationshipPresentation(locale, user.currentRelationship).shortLabel}</small>
                    ) : <small>{relationshipPresentation(locale, user.currentRelationship).description}</small>}
                  </div>
                  <div className="user-record__observation">
                    <span><Icon name="clock" />{relativeTime(user.lastSeenAt, locale)}</span>
                    <small>{t("observationCount", { count: user.observationCount, source: sourceTypeLabel(locale, user.lastSourceType) })}</small>
                  </div>
                  <div className="user-record__actions">
                    {user.hasChanged ? <button title={t("acknowledgeChangeTitle")} aria-label={t("acknowledgeChangeAria")} onClick={() => void acknowledgeChange(user.key)}><Icon name="check" /></button> : null}
                    <button title={t("viewHistoryTitle")} aria-label={t("viewHistoryAria")} className={expanded ? "is-active" : ""} onClick={() => setExpandedUser(expanded ? null : user.key)}><Icon name="history" /></button>
                    <button title={t("deleteRecordTitle")} aria-label={t("deleteRecordAria")} onClick={() => void deleteOne(user)}><Icon name="trash" /></button>
                  </div>
                  {expanded ? <div className="user-record__history"><UserHistory userKey={user.key} /></div> : null}
                </article>
              );
            })}
          </div>
        </section>
      </div>

      {notice ? <button className="toast" onClick={() => setNotice(null)}>{notice}<span>×</span></button> : null}
      <footer className="dashboard-footer">
        <Brand compact locale={locale} />
        <p>{t("localOnlyFooter")}</p>
        <a
          aria-label={t("sendFeedbackAria")}
          className="dashboard-footer__feedback"
          href={PROJECT_FEEDBACK_URL}
          rel="noreferrer"
          target="_blank"
        >
          {t("sendFeedback")}
        </a>
        <p>{t("brandName")} {extensionVersion}</p>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Dashboard />);

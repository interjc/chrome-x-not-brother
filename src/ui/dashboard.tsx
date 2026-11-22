import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/newsreader";
import "./styles.css";

import type { CSSProperties, ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { PROJECT_FEEDBACK_URL } from "../domain/project";
import { profileUrlForHandle, visibleDisplayName } from "../domain/identity";
import { isDisplayedUser, recordedRelationshipChange } from "../domain/relationships";
import { parseDatabaseExport, usersToCsv } from "../domain/export";
import type { ObservationRecord, UserRecord } from "../domain/types";
import {
  resolveUiLocale,
  relationshipPresentation,
  sourceTypeLabel,
  translate,
  type AppLocale,
  type MessageKey,
} from "../i18n";
import {
  LEGACY_VIEWER,
  acknowledgeRelationshipChange,
  clearArchive,
  copyArchive,
  deleteUserRecord,
  exportDatabase,
  getUserHistory,
  importDatabase,
} from "../storage/database";
import { Avatar } from "./components/Avatar";
import { Brand } from "./components/Brand";
import { Icon } from "./components/Icon";
import {
  FILTER_RULES_EDITOR_HASH,
  FilterRulesManager,
  confirmLeaveFilterRulesEditor,
  revealFilterRulesEditor,
} from "./components/FilterRulesManager";
import { InterceptStats } from "./components/InterceptStats";
import { OptionsPanel } from "./components/OptionsPanel";
import { RelationshipPill } from "./components/RelationshipPill";
import {
  ARCHIVE_CHANGE_FILTERS,
  ARCHIVE_RELATIONSHIP_FILTERS,
  DEFAULT_ARCHIVE_QUERY,
  archiveFacetCounts,
  filterArchiveUsers,
  hasActiveArchiveFilters,
  matchesChange,
  type ArchiveChangeFilter,
  type ArchiveQuery,
  type ArchiveRelationshipFilter,
  type ArchiveSort,
} from "./archive-model";
import { absoluteTime, downloadFile, relativeTime } from "./format";
import {
  useArchiveScopes,
  useFilterRuleStatus,
  useHideStats,
  useLegacyClaim,
  useObserverSettings,
  useUsers,
} from "./hooks";
import { CURRENT_CONSENT_VERSION } from "../storage/settings";

type DashboardSection = "archive" | "filter-rules" | "settings";

const DASHBOARD_SECTIONS = [
  { id: "archive", label: "dashboardSectionArchive" },
  { id: "filter-rules", label: "dashboardSectionBlacklist" },
  { id: "settings", label: "dashboardSectionSettings" },
] as const satisfies readonly { id: DashboardSection; label: MessageKey }[];

const extensionVersion = chrome.runtime.getManifest?.().version ?? "dev";

function t(
  locale: AppLocale,
  key: MessageKey,
  values?: Record<string, string | number>,
) {
  return translate(locale, key, values);
}

function relationshipFilterLabel(locale: AppLocale, filter: ArchiveRelationshipFilter): string {
  return filter === "all"
    ? t(locale, "filterAll")
    : relationshipPresentation(locale, filter).label;
}

function changeFilterLabel(locale: AppLocale, filter: ArchiveChangeFilter): string {
  if (filter === "all") return t(locale, "changeFilterAll");
  if (filter === "any") return t(locale, "changeFilterAny");
  if (filter === "pending") return t(locale, "changeFilterPending");
  if (filter === "changed") return t(locale, "changeFilterOther");
  return relationshipPresentation(locale, filter).label;
}

/** Change kinds that only appear once some row has them. */
function isChangeKindFilter(filter: ArchiveChangeFilter): boolean {
  return filter !== "all" && filter !== "any" && filter !== "pending";
}

function dashboardSectionFromHash(hash: string): DashboardSection {
  if (hash === FILTER_RULES_EDITOR_HASH) return "filter-rules";
  if (hash === "#settings") return "settings";
  return "archive";
}

async function notifyDataChanged(): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: "data:changed" });
  } catch {
    // The local mutation already succeeded; open X tabs can recover on reload.
  }
}

function UserHistory({
  viewer,
  userKey,
  locale,
}: {
  viewer: string;
  userKey: string;
  locale: AppLocale;
}) {
  const [items, setItems] = useState<ObservationRecord[] | null>(null);

  useEffect(() => {
    setItems(null);
    void getUserHistory(viewer, userKey).then(setItems);
  }, [viewer, userKey]);

  if (items === null) {
    return <p className="history-loading">{t(locale, "historyLoading")}</p>;
  }

  return (
    <div className="history-list">
      {items.length === 0 ? <p>{t(locale, "historyEmpty")}</p> : null}
      {items.slice(0, 30).map((item, index) => {
        const older = items[index + 1];
        const transition = older !== undefined && older.relationship !== item.relationship;
        return (
        <div
          className={`history-item${transition ? " history-item--transition" : ""}`}
          key={item.id ?? `${item.userKey}-${item.observedAt}`}
          title={transition ? t(locale, "historyTransitionTitle") : undefined}
        >
          <time>{absoluteTime(item.observedAt, locale)}</time>
          <span className="history-item__state">
            {transition ? (
              <small>{relationshipPresentation(locale, older.relationship).shortLabel} →</small>
            ) : null}
            <RelationshipPill relationship={item.relationship} locale={locale} />
          </span>
          <span>{sourceTypeLabel(locale, item.sourceType)}</span>
          <a href={item.sourceUrl} target="_blank" rel="noreferrer" title={t(locale, "openObservationSource")}>
            <Icon name="external" />
          </a>
        </div>
        );
      })}
    </div>
  );
}

function Dashboard() {
  const { settings, settingsReady, setSettings, setSetting } = useObserverSettings();
  const locale = resolveUiLocale(settings.uiLocale);
  const scopes = useArchiveScopes();
  const { claim: legacyClaim, dismiss: dismissLegacyClaim } = useLegacyClaim();
  const [selectedOwner, setSelectedOwner] = useState<string | null>(null);
  const currentViewer = settings.viewerHandle;
  // The account whose archive is shown: a picked one, else the signed-in
  // account, else a still-unassigned 0.5.x archive.
  const owner = !settingsReady
    ? null
    : selectedOwner ??
      currentViewer ??
      (scopes.some((scope) => scope.viewer === LEGACY_VIEWER) ? LEGACY_VIEWER : null);
  const ownAccounts = useMemo(
    () => currentViewer
      ? [...settings.knownViewerHandles, currentViewer]
      : settings.knownViewerHandles,
    [currentViewer, settings.knownViewerHandles],
  );
  const { users: observedUsers, loading: usersLoading } = useUsers(owner, ownAccounts);
  const users = settingsReady
    ? observedUsers.filter((user) =>
      user.key !== currentViewer &&
      !settings.knownViewerHandles.includes(user.key) &&
      isDisplayedUser(user))
    : [];
  const loading = usersLoading || !settingsReady;
  const ownerOptions = useMemo(() => {
    const options = scopes.map((scope) => ({ viewer: scope.viewer, count: scope.userCount }));
    for (const viewer of [currentViewer, owner]) {
      if (viewer !== null && !options.some((option) => option.viewer === viewer)) {
        options.unshift({ viewer, count: 0 });
      }
    }
    return options;
  }, [scopes, currentViewer, owner]);
  const hasConsent = settings.consentVersion >= CURRENT_CONSENT_VERSION;
  const { status: filterStatus } = useFilterRuleStatus(
    settings.viewerHandle,
    hasConsent && settings.hideByFilterRules,
  );
  const { stats: hideStats } = useHideStats(settings.viewerHandle);
  const [section, setSection] = useState<DashboardSection>(() =>
    dashboardSectionFromHash(window.location.hash));
  const [query, setQuery] = useState<ArchiveQuery>(DEFAULT_ARCHIVE_QUERY);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const sectionRef = useRef(section);
  sectionRef.current = section;
  const isWelcome = new URLSearchParams(window.location.search).get("welcome") === "1";

  useEffect(() => {
    document.documentElement.lang = locale;
    const current = DASHBOARD_SECTIONS.find((item) => item.id === section);
    document.title = section === "archive"
      ? t(locale, "dashboardTitle")
      : `${t(locale, current?.label ?? "dashboardSectionArchive")} — ${t(locale, "brandName")}`;
  }, [locale, section]);

  useEffect(() => {
    const syncSection = (): void => {
      const next = dashboardSectionFromHash(window.location.hash);
      if (
        sectionRef.current === "filter-rules" &&
        next !== "filter-rules" &&
        !confirmLeaveFilterRulesEditor(locale)
      ) {
        if (window.location.hash !== FILTER_RULES_EDITOR_HASH) {
          window.history.replaceState(null, "", FILTER_RULES_EDITOR_HASH);
        }
        return;
      }
      setSection(next);
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(".dashboard-section-page h1")
          ?.focus({ preventScroll: true });
      });
    };
    window.addEventListener("hashchange", syncSection);
    return () => window.removeEventListener("hashchange", syncSection);
  }, [locale]);

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

  const visibleUsers = useMemo(() => filterArchiveUsers(users, query), [query, users]);
  const facets = useMemo(() => archiveFacetCounts(users, query), [query, users]);
  const filtersActive = hasActiveArchiveFilters(query);
  const totals = useMemo(() => ({
    followingOnly: users.filter((user) => user.currentRelationship === "following_only").length,
    blockedBy: users.filter((user) => user.currentRelationship === "blocked_by").length,
    pending: users.filter((user) => matchesChange(user, "pending")).length,
  }), [users]);
  const lastSeenAt = users.reduce((latest, user) => Math.max(latest, user.lastSeenAt), 0);

  function updateQuery(patch: Partial<ArchiveQuery>): void {
    setQuery((current) => ({ ...current, ...patch }));
  }

  function showOnly(patch: Partial<ArchiveQuery>): void {
    setQuery((current) => ({ ...current, relationship: "all", change: "all", ...patch }));
  }

  function clearFilters(): void {
    setQuery((current) => ({ ...DEFAULT_ARCHIVE_QUERY, sort: current.sort }));
  }

  function ownerName(viewer: string): string {
    return viewer === LEGACY_VIEWER ? t(locale, "archiveOwnerUnclaimed") : `@${viewer}`;
  }

  function ownerOptionLabel(viewer: string, count: number): string {
    const formatted = count.toLocaleString(locale);
    if (viewer === LEGACY_VIEWER) return t(locale, "archiveOptionUnclaimed", { count: formatted });
    return t(locale, viewer === currentViewer ? "archiveOptionCurrent" : "archiveOptionOther", {
      handle: viewer,
      count: formatted,
    });
  }

  async function mergeIntoCurrent(): Promise<void> {
    if (owner === null || !currentViewer || owner === currentViewer) return;
    const from = ownerName(owner);
    if (!window.confirm(t(locale, "archiveMergeConfirm", { from, to: currentViewer }))) return;
    const count = await copyArchive(owner, currentViewer, ownAccounts);
    await notifyDataChanged();
    setSelectedOwner(currentViewer);
    setNotice(t(locale, "archiveMergeSuccess", { count, from, to: currentViewer }));
  }

  async function exportJson(): Promise<void> {
    if (owner === null) return;
    const payload = await exportDatabase(owner, ownAccounts);
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
    if (owner === null) {
      setNotice(t(locale, "archiveNoAccount"));
      return;
    }
    try {
      const payload = parseDatabaseExport(JSON.parse(await file.text()) as unknown);
      if (
        payload.schemaVersion === 2 &&
        payload.viewerHandle &&
        payload.viewerHandle !== owner &&
        !window.confirm(t(locale, "importOtherAccountConfirm", {
          from: payload.viewerHandle,
          to: ownerName(owner),
        }))
      ) return;
      await importDatabase(owner, payload, ownAccounts);
      await notifyDataChanged();
      setNotice(t(locale, "importSuccess", { count: payload.users.length }));
    } catch {
      setNotice(t(locale, "importFailed"));
    }
  }

  async function clearEverything(): Promise<void> {
    if (owner === null) return;
    const name = ownerName(owner);
    if (!window.confirm(t(locale, "clearConfirm", { owner: name }))) return;
    await clearArchive(owner);
    await notifyDataChanged();
    setNotice(t(locale, "clearSuccess", { owner: name }));
  }

  async function deleteOne(user: UserRecord): Promise<void> {
    if (owner === null) return;
    if (!window.confirm(t(locale, "deleteConfirm", { handle: user.handle }))) return;
    await deleteUserRecord(owner, user.key);
    await notifyDataChanged();
    setNotice(t(locale, "deleteSuccess", { handle: user.handle }));
  }

  async function acknowledgeChange(userKey: string): Promise<void> {
    if (owner === null) return;
    await acknowledgeRelationshipChange(owner, userKey);
    await notifyDataChanged();
  }

  async function enableObserver(): Promise<void> {
    await setSettings({
      consentVersion: CURRENT_CONSENT_VERSION,
      observerEnabled: true,
    });
    setNotice(t(locale, "observerStarted"));
  }

  function openFilterRulesEditor(): void {
    if (window.location.hash !== FILTER_RULES_EDITOR_HASH) {
      window.location.hash = FILTER_RULES_EDITOR_HASH;
      return;
    }
    setSection("filter-rules");
    window.requestAnimationFrame(() => revealFilterRulesEditor());
  }

  return (
    <main className="app app--dashboard">
      <header className="dashboard-header">
        <Brand locale={locale} />
        <div className="dashboard-header__tools">
          <span className={`observer-state${settings.observerEnabled ? " is-on" : ""}`}>
            <i />{t(locale, settings.observerEnabled ? "observerRunning" : "observerPaused")}
          </span>
          {section === "archive" ? (
            <>
              <button className="icon-button" title={t(locale, "importJson")} aria-label={t(locale, "importJson")} onClick={() => importInput.current?.click()}><Icon name="upload" /></button>
              <input ref={importInput} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void importJson(event)} />
              <button className="icon-button" title={t(locale, "exportJson")} aria-label={t(locale, "exportJson")} onClick={() => void exportJson()}><Icon name="download" /></button>
            </>
          ) : null}
        </div>
      </header>

      <nav
        className="dashboard-tabs"
        role="tablist"
        aria-label={t(locale, "dashboardSectionNavAria")}
      >
        {DASHBOARD_SECTIONS.map((item) => (
          <a
            aria-controls={`dashboard-panel-${item.id}`}
            aria-selected={section === item.id}
            className={`dashboard-tab${section === item.id ? " is-active" : ""}`}
            href={`#${item.id}`}
            id={`dashboard-tab-${item.id}`}
            key={item.id}
            role="tab"
          >
            {t(locale, item.label)}
          </a>
        ))}
      </nav>

      {section === "archive" ? (
        <div
          aria-labelledby="dashboard-tab-archive"
          className="dashboard-section-page dashboard-section-page--archive"
          id="dashboard-panel-archive"
          role="tabpanel"
        >
      <section className="hero">
        <div className="hero__copy">
          <p className="eyebrow">{t(locale, "fieldbookEyebrow")}</p>
          <h1 tabIndex={-1}>{t(locale, "heroTitleBefore")}<br /><em>{t(locale, "heroTitleAfter")}</em></h1>
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

      <section className="archive-owner" aria-label={t(locale, "archiveOwnerLabel")}>
        {owner === null ? (
          <p className="archive-owner__empty">{t(locale, "archiveNoAccount")}</p>
        ) : (
          <>
            <label className="sort-box archive-owner__select">
              {t(locale, "archiveOwnerLabel")}
              <select
                translate="no"
                value={owner}
                onChange={(event) => {
                  setSelectedOwner(event.target.value);
                  setExpandedUser(null);
                }}
              >
                {ownerOptions.map((option) => (
                  <option key={option.viewer || "legacy"} value={option.viewer}>
                    {ownerOptionLabel(option.viewer, option.count)}
                  </option>
                ))}
              </select>
              <Icon name="chevron" />
            </label>
            {currentViewer && owner !== currentViewer ? (
              <button className="archive-owner__merge" type="button" onClick={() => void mergeIntoCurrent()}>
                <Icon name="database" />
                {t(locale, "archiveMergeInto", { handle: currentViewer })}
              </button>
            ) : null}
            <p className="archive-owner__hint">{t(locale, "archiveScopeHint")}</p>
          </>
        )}
        {legacyClaim && !legacyClaim.dismissed ? (
          <div className="archive-owner__notice" role="status">
            <p>{t(locale, "legacyClaimNotice", {
              count: legacyClaim.userCount.toLocaleString(locale),
              handle: legacyClaim.viewer,
            })}</p>
            <button type="button" onClick={() => void dismissLegacyClaim()}>
              {t(locale, "legacyClaimDismiss")}
            </button>
          </div>
        ) : null}
      </section>

      <section className="stats-strip stats-strip--shortcuts" aria-label={t(locale, "archiveStatsAria")}>
        <button
          aria-label={t(locale, "statShortcutAria", { label: t(locale, "filterAll") })}
          aria-pressed={!filtersActive}
          type="button"
          onClick={clearFilters}
        >
          <span>OBSERVED</span><strong>{loading ? "—" : users.length.toLocaleString(locale)}</strong><small>{t(locale, "statObserved")}</small>
        </button>
        <button
          aria-label={t(locale, "statShortcutAria", { label: relationshipFilterLabel(locale, "following_only") })}
          aria-pressed={query.relationship === "following_only" && query.change === "all"}
          className="tone-following"
          type="button"
          onClick={() => showOnly({ relationship: "following_only" })}
        >
          <span>ONE-WAY</span><strong>{totals.followingOnly.toLocaleString(locale)}</strong><small>{t(locale, "statFollowingOnly")}</small>
        </button>
        <button
          aria-label={t(locale, "statShortcutAria", { label: relationshipFilterLabel(locale, "blocked_by") })}
          aria-pressed={query.relationship === "blocked_by" && query.change === "all"}
          className="tone-blocked"
          type="button"
          onClick={() => showOnly({ relationship: "blocked_by" })}
        >
          <span>BLOCKED BY</span><strong>{totals.blockedBy.toLocaleString(locale)}</strong><small>{t(locale, "statBlockedBy")}</small>
        </button>
        <button
          aria-label={t(locale, "statShortcutAria", { label: changeFilterLabel(locale, "pending") })}
          aria-pressed={query.change === "pending" && query.relationship === "all"}
          className="tone-changed"
          type="button"
          onClick={() => showOnly({ change: "pending", sort: "changed" })}
        >
          <span>CHANGED</span><strong>{totals.pending.toLocaleString(locale)}</strong><small>{t(locale, "statChanged")}</small>
        </button>
      </section>
      {hasConsent ? (
        <InterceptStats locale={locale} stats={hideStats} status={filterStatus} />
      ) : null}

      <div className="fieldbook-layout">
        <aside className="filter-rail" aria-label={t(locale, "relationshipFilterAria")}>
          <div className="filter-rail__heading"><span>INDEX</span><strong>{t(locale, "relationshipIndex")}</strong></div>
          <nav aria-labelledby="filter-group-current">
            <p className="filter-rail__group" id="filter-group-current"><span>A</span>{t(locale, "filterGroupCurrent")}</p>
            {ARCHIVE_RELATIONSHIP_FILTERS.map((filter, index) => (
              <button
                aria-pressed={query.relationship === filter}
                className={`filter-rail__option filter-rail__option--${filter}${query.relationship === filter ? " is-active" : ""}`}
                key={filter}
                type="button"
                onClick={() => updateQuery({ relationship: filter })}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{relationshipFilterLabel(locale, filter)}</strong>
                <em>{facets.relationship[filter]}</em>
              </button>
            ))}
          </nav>
          <nav aria-labelledby="filter-group-change">
            <p className="filter-rail__group" id="filter-group-change"><span>B</span>{t(locale, "filterGroupChange")}</p>
            {ARCHIVE_CHANGE_FILTERS.map((filter, index) => {
              const count = facets.change[filter];
              const active = query.change === filter;
              if (isChangeKindFilter(filter) && count === 0 && !active) return null;
              return (
                <button
                  aria-pressed={active}
                  className={`filter-rail__option filter-rail__option--change-${filter}${isChangeKindFilter(filter) ? " is-nested" : ""}${active ? " is-active" : ""}`}
                  key={filter}
                  type="button"
                  onClick={() => updateQuery({ change: filter })}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{changeFilterLabel(locale, filter)}</strong>
                  <em>{count}</em>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="records-panel">
          <div className="records-toolbar">
            <label className="search-box">
              <Icon name="search" />
              <input
                ref={searchInput}
                type="search"
                value={query.text}
                onChange={(event) => updateQuery({ text: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && query.text) {
                    event.preventDefault();
                    updateQuery({ text: "" });
                  }
                }}
                placeholder={t(locale, "searchPlaceholder")}
              />
              <kbd>⌘ K</kbd>
            </label>
            <label className="sort-box">{t(locale, "sortLabel")}
              <select value={query.sort} onChange={(event) => updateQuery({ sort: event.target.value as ArchiveSort })}>
                <option value="recent">{t(locale, "sortRecent")}</option>
                <option value="changed">{t(locale, "sortRecentChange")}</option>
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
            <div className="records-meta__filters">
              <p aria-live="polite">{t(locale, "matchingRecords", { count: visibleUsers.length.toLocaleString(locale) })}</p>
              {query.relationship !== "all" ? (
                <button
                  aria-label={t(locale, "removeFilterAria", { label: relationshipFilterLabel(locale, query.relationship) })}
                  className={`filter-chip filter-chip--${query.relationship}`}
                  type="button"
                  onClick={() => updateQuery({ relationship: "all" })}
                >
                  <i aria-hidden="true" />{relationshipFilterLabel(locale, query.relationship)}<span aria-hidden="true">×</span>
                </button>
              ) : null}
              {query.change !== "all" ? (
                <button
                  aria-label={t(locale, "removeFilterAria", { label: changeFilterLabel(locale, query.change) })}
                  className="filter-chip filter-chip--change"
                  type="button"
                  onClick={() => updateQuery({ change: "all" })}
                >
                  <i aria-hidden="true" />{changeFilterLabel(locale, query.change)}<span aria-hidden="true">×</span>
                </button>
              ) : null}
              {query.text.trim() ? (
                <button
                  aria-label={t(locale, "removeFilterAria", { label: query.text.trim() })}
                  className="filter-chip filter-chip--text"
                  type="button"
                  onClick={() => updateQuery({ text: "" })}
                >
                  <Icon name="search" />“{query.text.trim()}”<span aria-hidden="true">×</span>
                </button>
              ) : null}
              {filtersActive ? (
                <button className="records-meta__clear" type="button" onClick={clearFilters}>
                  {t(locale, "clearFilters")}
                </button>
              ) : null}
            </div>
            <p>{t(locale, "recentlyRefreshed")} <span>{lastSeenAt ? relativeTime(lastSeenAt, locale) : t(locale, "neverObserved")}</span></p>
          </div>

          <div className="record-list">
            {visibleUsers.length > 0 ? (
              <div className="record-columns" aria-hidden="true">
                <span />
                <span>{t(locale, "columnAccount")}</span>
                <span>{t(locale, "filterGroupCurrent")}</span>
                <span>{t(locale, "filterGroupChange")}</span>
                <span>{t(locale, "columnLastSeen")}</span>
                <span />
              </div>
            ) : null}
            {!loading && visibleUsers.length === 0 ? (
              <div className="dashboard-empty">
                <Icon name="eye" />
                <h2>{t(locale, "emptyDashboardTitle")}</h2>
                <p>{t(locale, "emptyDashboardBody")}</p>
                {filtersActive ? (
                  <button type="button" onClick={clearFilters}>{t(locale, "clearFilters")}</button>
                ) : null}
              </div>
            ) : null}
            {visibleUsers.map((user, index) => {
              const change = recordedRelationshipChange(user);
              const current = user.currentRelationship === "none" || user.currentRelationship === "unknown"
                ? null
                : user.currentRelationship;
              const expanded = expandedUser === user.key;
              return (
                <article
                  className={`user-record user-record--${current ?? "unknown"}${change?.pending ? " is-pending" : ""}`}
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
                    <Avatar avatarUrl={user.avatarUrl} handle={user.handle} />
                    <span className="user-record__identity">
                      <strong>{visibleDisplayName(user.displayName, user.handle)}</strong>
                      <span translate="no">@{user.handle}<Icon name="external" /></span>
                    </span>
                  </a>
                  <div className="user-record__relationship">
                    {current ? <RelationshipPill relationship={current} locale={locale} /> : null}
                    <small>{relationshipPresentation(locale, user.currentRelationship).description}</small>
                  </div>
                  <div className="user-record__change">
                    {change ? (
                      <>
                        <span className={`change-tag change-tag--${change.kind}`}>
                          {relationshipPresentation(locale, change.kind).label}
                          {change.pending ? <em>{t(locale, "changeFilterPending")}</em> : null}
                        </span>
                        <small>
                          {relationshipPresentation(locale, change.previous).shortLabel} → {relationshipPresentation(locale, change.current).shortLabel}
                          {change.detectedAt ? ` · ${t(locale, "changeDetectedAt", { time: relativeTime(change.detectedAt, locale) })}` : ""}
                        </small>
                      </>
                    ) : (
                      <small className="user-record__no-change">{t(locale, "noChangeRecorded")}</small>
                    )}
                  </div>
                  <div className="user-record__observation">
                    <span><Icon name="clock" />{relativeTime(user.lastSeenAt, locale)}</span>
                    <small>{t(locale, "observationCount", { count: user.observationCount, source: sourceTypeLabel(locale, user.lastSourceType) })}</small>
                  </div>
                  <div className="user-record__actions">
                    {change?.pending ? <button title={t(locale, "acknowledgeChangeTitle")} aria-label={t(locale, "acknowledgeChangeAria")} onClick={() => void acknowledgeChange(user.key)}><Icon name="check" /></button> : null}
                    <button title={t(locale, "viewHistoryTitle")} aria-label={t(locale, "viewHistoryAria")} aria-expanded={expanded} className={expanded ? "is-active" : ""} onClick={() => setExpandedUser(expanded ? null : user.key)}><Icon name="history" /></button>
                    <button title={t(locale, "deleteRecordTitle")} aria-label={t(locale, "deleteRecordAria")} onClick={() => void deleteOne(user)}><Icon name="trash" /></button>
                  </div>
                  {expanded && owner !== null ? <div className="user-record__history"><UserHistory viewer={owner} userKey={user.key} locale={locale} /></div> : null}
                </article>
              );
            })}
          </div>
        </section>
      </div>
        </div>
      ) : section === "filter-rules" ? (
        <div
          aria-labelledby="dashboard-tab-filter-rules"
          className="dashboard-section-page dashboard-section-page--filter-rules"
          id="dashboard-panel-filter-rules"
          role="tabpanel"
        >
          <FilterRulesManager
            disabled={!settingsReady || !hasConsent}
            enabled={settings.hideByFilterRules}
            hideStats={hideStats}
            locale={locale}
            standalone
            viewerHandle={settings.viewerHandle}
            onEnabledChange={(enabled) => void setSetting("hideByFilterRules", enabled)}
          />
        </div>
      ) : (
        <div
          aria-labelledby="dashboard-tab-settings"
          className="dashboard-section-page dashboard-section-page--settings"
          id="dashboard-panel-settings"
          role="tabpanel"
        >
          <OptionsPanel
            locale={locale}
            onChange={(key, value) => void setSetting(key, value)}
            onEditFilterRules={openFilterRulesEditor}
            settings={settings}
            settingsReady={settingsReady}
            showObserverToggle
          />
        </div>
      )}

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

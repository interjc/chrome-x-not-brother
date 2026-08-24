import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/newsreader";
import "./styles.css";

import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { PROJECT_FEEDBACK_URL } from "../domain/project";
import { profileUrlForHandle, visibleDisplayName } from "../domain/identity";
import { displayRelationship, isDisplayedUser } from "../domain/relationships";
import {
  resolveUiLocale,
  relationshipPresentation,
  translate,
  type MessageKey,
} from "../i18n";
import { Avatar } from "./components/Avatar";
import { Brand } from "./components/Brand";
import { Icon } from "./components/Icon";
import { OptionsPanel } from "./components/OptionsPanel";
import { RelationshipPill } from "./components/RelationshipPill";
import { relativeTime } from "./format";
import { useObserverSettings, useUsers } from "./hooks";
import {
  filterSidePanelUsers,
  SIDE_PANEL_SUMMARY_KINDS,
  toggleSidePanelFilter,
  type SidePanelFilter,
} from "./sidepanel-model";
import { CURRENT_CONSENT_VERSION } from "../storage/settings";
import type { SidePanelTab } from "../domain/types";

export function SidePanel() {
  const [filter, setFilter] = useState<SidePanelFilter>("all");
  const { users: observedUsers, loading: usersLoading } = useUsers();
  const { settings, settingsReady, setSettings, setSetting } = useObserverSettings();
  const locale = resolveUiLocale(settings.uiLocale);
  const t = (key: MessageKey, values?: Record<string, string | number>) =>
    translate(locale, key, values);

  const tab = settings.sidePanelTab;
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = translate(locale, tab === "options" ? "optionsTitle" : "brandName");
  }, [locale, tab]);
  const users = settingsReady
    ? observedUsers.filter((user) =>
      user.key !== settings.viewerHandle && isDisplayedUser(user),
    )
    : [];
  const loading = usersLoading || !settingsReady;
  const changed = users.filter((user) => user.hasChanged).length;
  const changedText = changed.toLocaleString(locale);
  const hasConsent = settings.consentVersion >= CURRENT_CONSENT_VERSION;
  const filteredUsers = filterSidePanelUsers(users, filter);
  const visibleUsers = filteredUsers.slice(0, filter === "all" ? 8 : 40);
  const filterLabel = filter === "all"
    ? t("recentHeading")
    : filter === "changed"
      ? relationshipPresentation(locale, "changed").label
      : relationshipPresentation(locale, filter).label;

  function toggleFilter(next: Exclude<SidePanelFilter, "all">): void {
    setFilter((current) => toggleSidePanelFilter(current, next));
  }

  function selectTab(next: SidePanelTab): void {
    void setSetting("sidePanelTab", next);
  }

  return (
    <main className="app app--sidepanel">
      <header className="side-header">
        <Brand compact locale={locale} />
        <button
          className={`observer-switch${settings.observerEnabled ? " is-on" : ""}`}
          type="button"
          disabled={!settingsReady || !hasConsent}
          title={t(settings.observerEnabled ? "observerPauseTitle" : "observerResumeTitle")}
          aria-label={t(settings.observerEnabled ? "observerPauseAria" : "observerStartAria")}
          onClick={() => void setSetting("observerEnabled", !settings.observerEnabled)}
        >
          <Icon name={settings.observerEnabled ? "pause" : "play"} />
          <span>{t(settings.observerEnabled ? "observing" : "paused")}</span>
        </button>
      </header>
      <div className="side-tabs" role="tablist" aria-label={t("sideTablistAria")}>
        <button
          aria-controls="side-panel-status"
          aria-selected={tab === "status"}
          className={`side-tab${tab === "status" ? " is-active" : ""}`}
          id="side-tab-status"
          onClick={() => selectTab("status")}
          role="tab"
          type="button"
        >
          {t("sideTabStatus")}
        </button>
        <button
          aria-controls="side-panel-options"
          aria-selected={tab === "options"}
          className={`side-tab${tab === "options" ? " is-active" : ""}`}
          id="side-tab-options"
          onClick={() => selectTab("options")}
          role="tab"
          type="button"
        >
          {t("sideTabOptions")}
        </button>
      </div>

      {tab === "options" ? (
        <div
          aria-labelledby="side-tab-options"
          className="side-tab-panel"
          id="side-panel-options"
          role="tabpanel"
        >
          <OptionsPanel
            locale={locale}
            onChange={(key, value) => void setSetting(key, value)}
            settings={settings}
            settingsReady={settingsReady}
          />
        </div>
      ) : (
        <div
          aria-labelledby="side-tab-status"
          className="side-tab-panel"
          id="side-panel-status"
          role="tabpanel"
        >
      {settingsReady && !hasConsent ? (
        <section className="consent-card" aria-labelledby="consent-title">
          <p className="eyebrow">{t("consentEyebrow")}</p>
          <h1 id="consent-title">{t("consentTitle")}</h1>
          <p>{t("consentBody")}</p>
          <ul>
            <li>{t("consentLocalOnly")}</li>
            <li>{t("consentNoSensitiveData")}</li>
            <li>{t("consentNoAutomation")}</li>
          </ul>
          <button
            className="consent-button"
            type="button"
            onClick={() => void setSettings({
              consentVersion: CURRENT_CONSENT_VERSION,
              observerEnabled: true,
            })}
          >
            {t("consentButton")}
            <Icon name="chevron" />
          </button>
          <p className="consent-card__note">{t("consentNote")}</p>
        </section>
      ) : null}

      <section className={`side-intro${settingsReady && !hasConsent ? " is-locked" : ""}`}>
        <p className="eyebrow">{t("sideIntroEyebrow")}</p>
        <div className="side-intro__count">
          <strong>{loading ? "—" : users.length.toLocaleString(locale)}</strong>
          <span>{t("observedAccountCount")}</span>
        </div>
        <p>{t("sideIntroBody")}</p>
      </section>

      <section className={`mini-stats${settingsReady && !hasConsent ? " is-locked" : ""}`} aria-label={t("relationshipOverview")}>
        {SIDE_PANEL_SUMMARY_KINDS.map((kind) => {
          const count = users.filter((user) => user.currentRelationship === kind).length;
          const countText = count.toLocaleString(locale);
          const label = relationshipPresentation(locale, kind).shortLabel;
          return (
            <button
              aria-label={t("filterRelationshipAria", { label, count: countText })}
              aria-pressed={filter === kind}
              className={`mini-stat mini-stat--${kind}${filter === kind ? " is-active" : ""}`}
              key={kind}
              onClick={() => toggleFilter(kind)}
              type="button"
            >
              <i aria-hidden="true" />
              <span>{label}</span>
              <strong>{countText}</strong>
            </button>
          );
        })}
      </section>

      {changed > 0 || filter === "changed" ? (
        <button
          aria-label={t("filterRelationshipAria", {
            label: relationshipPresentation(locale, "changed").label,
            count: changedText,
          })}
          aria-pressed={filter === "changed"}
          className={`change-callout${filter === "changed" ? " is-active" : ""}`}
          onClick={() => toggleFilter("changed")}
          type="button"
        >
          <Icon name="history" />
          <div><strong>{t("changedCount", { count: changedText })}</strong><span>{t("changedHint")}</span></div>
        </button>
      ) : null}

      <section className={`recent-section${settingsReady && !hasConsent ? " is-locked" : ""}`}>
        <div className="section-heading">
          <div>
            <span>{t(filter === "all" ? "sideRecentEyebrow" : "sideFilteredEyebrow")}</span>
            <h1>{filterLabel}</h1>
          </div>
          <Icon name="clock" />
        </div>
        <div aria-live="polite" className="recent-list">
          {!loading && users.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state__orb"><Icon name="eye" /></span>
              <strong>{t("emptyFirstTitle")}</strong>
              <p>{t("emptyFirstBody")}</p>
            </div>
          ) : null}
          {!loading && users.length > 0 && filteredUsers.length === 0 ? (
            <div className="empty-state empty-state--filtered">
              <span className="empty-state__orb"><Icon name="search" /></span>
              <strong>{t("filteredEmptyTitle")}</strong>
              <p>{t("filteredEmptyBody")}</p>
            </div>
          ) : null}
          {visibleUsers.map((user) => (
            <a
              aria-label={t("openProfileAria", { handle: user.handle })}
              className="recent-user"
              href={profileUrlForHandle(user.handle)}
              key={user.key}
              rel="noreferrer"
              target="_blank"
            >
              <Avatar avatarUrl={user.avatarUrl} displayName={user.displayName} handle={user.handle} />
              <div className="recent-user__identity">
                <strong>{visibleDisplayName(user.displayName, user.handle)}</strong>
                <span translate="no">@{user.handle} · {relativeTime(user.lastSeenAt, locale)}</span>
              </div>
              <span className="recent-user__relation">
                <RelationshipPill relationship={displayRelationship(user)} locale={locale} />
                <Icon name="external" />
              </span>
            </a>
          ))}
        </div>
      </section>
        </div>
      )}

      <footer className="side-footer">
        <button
          className="primary-button"
          type="button"
          onClick={() => void chrome.runtime.sendMessage({ type: "dashboard:open" })}
        >
          <Icon name="database" />
          {t("openArchive")}
          <Icon name="external" />
        </button>
        <p><span className="status-dot" />{t("localChromeOnly")}</p>
        <a
          aria-label={t("sendFeedbackAria")}
          className="side-footer__feedback"
          href={PROJECT_FEEDBACK_URL}
          rel="noreferrer"
          target="_blank"
        >
          {t("sendFeedback")}
        </a>
      </footer>
    </main>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<SidePanel />);

import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/newsreader";
import "./styles.css";

import { createRoot } from "react-dom/client";
import { displayRelationship } from "../domain/relationships";
import type { RelationshipKind } from "../domain/types";
import {
  getExtensionLocale,
  relationshipPresentation,
  translate,
  type MessageKey,
} from "../i18n";
import { Avatar } from "./components/Avatar";
import { Brand } from "./components/Brand";
import { Icon } from "./components/Icon";
import { RelationshipPill } from "./components/RelationshipPill";
import { relativeTime } from "./format";
import { useObserverSettings, useUsers } from "./hooks";
import { CURRENT_CONSENT_VERSION } from "../storage/settings";

const summaryKinds: RelationshipKind[] = [
  "mutual",
  "following_only",
  "follows_you_only",
  "blocked_by",
];

const locale = getExtensionLocale();
const t = (key: MessageKey, values?: Record<string, string | number>) =>
  translate(locale, key, values);
document.documentElement.lang = locale;
document.title = t("brandName");

function SidePanel() {
  const { users: observedUsers, loading: usersLoading } = useUsers();
  const { settings, settingsReady, setSettings, setSetting } = useObserverSettings();
  const users = settingsReady
    ? observedUsers.filter((user) =>
      user.key !== settings.viewerHandle && user.currentRelationship !== "unknown",
    )
    : [];
  const loading = usersLoading || !settingsReady;
  const changed = users.filter((user) => user.hasChanged).length;
  const hasConsent = settings.consentVersion >= CURRENT_CONSENT_VERSION;

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
        {summaryKinds.map((kind) => (
          <article className={`mini-stat mini-stat--${kind}`} key={kind}>
            <i aria-hidden="true" />
            <span>{relationshipPresentation(locale, kind).shortLabel}</span>
            <strong>{users.filter((user) => user.currentRelationship === kind).length}</strong>
          </article>
        ))}
      </section>

      {changed > 0 ? (
        <section className="change-callout">
          <Icon name="history" />
          <div><strong>{t("changedCount", { count: changed })}</strong><span>{t("changedHint")}</span></div>
        </section>
      ) : null}

      <section className={`recent-section${settingsReady && !hasConsent ? " is-locked" : ""}`}>
        <div className="section-heading">
          <div><span>RECENT</span><h2>{t("recentHeading")}</h2></div>
          <Icon name="clock" />
        </div>
        <div className="recent-list">
          {!loading && users.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state__orb"><Icon name="eye" /></span>
              <strong>{t("emptyFirstTitle")}</strong>
              <p>{t("emptyFirstBody")}</p>
            </div>
          ) : null}
          {users.slice(0, 8).map((user) => (
            <article className="recent-user" key={user.key}>
              <Avatar avatarUrl={user.avatarUrl} displayName={user.displayName} handle={user.handle} />
              <div className="recent-user__identity">
                <strong>{user.displayName ?? `@${user.handle}`}</strong>
                <span>@{user.handle} · {relativeTime(user.lastSeenAt, locale)}</span>
              </div>
              <RelationshipPill relationship={displayRelationship(user)} locale={locale} />
            </article>
          ))}
        </div>
      </section>

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
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<SidePanel />);

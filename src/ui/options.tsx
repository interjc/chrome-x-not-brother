import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/newsreader";
import "./styles.css";

import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { resolveUiLocale, translate, type MessageKey } from "../i18n";
import { Brand } from "./components/Brand";
import { OptionsPanel } from "./components/OptionsPanel";
import { useObserverSettings } from "./hooks";
import { openSidePanelOptionsTab } from "./open-options-tab";

export function OptionsPage() {
  const { settings, settingsReady, setSetting } = useObserverSettings();
  const locale = resolveUiLocale(settings.uiLocale);
  const t = (key: MessageKey) => translate(locale, key);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = translate(locale, "optionsTitle");
  }, [locale]);

  useEffect(() => {
    let cancelled = false;
    void openSidePanelOptionsTab().then((opened) => {
      if (cancelled) return;
      if (opened) {
        window.close();
        return;
      }
      setStandalone(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="app app--options">
      <header className="options-header">
        <Brand locale={locale} />
      </header>
      {standalone ? (
        <OptionsPanel
          locale={locale}
          note="optionsOpenFailed"
          onChange={(key, value) => void setSetting(key, value)}
          settings={settings}
          settingsReady={settingsReady}
        />
      ) : (
        <p className="options-opening">{t("optionsOpening")}</p>
      )}
    </main>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<OptionsPage />);

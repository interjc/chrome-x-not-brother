import { translate, type AppLocale } from "../../i18n";

export function Brand({ compact = false, locale }: { compact?: boolean; locale: AppLocale }) {
  return (
    <div className={`brand${compact ? " brand--compact" : ""}`}>
      <img className="brand__mark" src="icons/icon-128.png" alt="" aria-hidden="true" />
      <span className="brand__copy">
        <strong>{translate(locale, "brandName")}</strong>
        <small>{translate(locale, "brandTagline")}</small>
      </span>
    </div>
  );
}

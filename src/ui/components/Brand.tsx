import { translate, type AppLocale } from "../../i18n";

export function Brand({ compact = false, locale }: { compact?: boolean; locale: AppLocale }) {
  return (
    <div className={`brand${compact ? " brand--compact" : ""}`} translate="no">
      <img
        aria-hidden="true"
        alt=""
        className="brand__mark"
        height="48"
        src="icons/icon-128.png"
        width="48"
      />
      <span className="brand__copy">
        <strong>{translate(locale, "brandName")}</strong>
        <small>{translate(locale, "brandTagline")}</small>
      </span>
    </div>
  );
}

import type { DisplayRelationship } from "../../domain/types";
import { relationshipPresentation, type AppLocale } from "../../i18n";

export function RelationshipPill({
  relationship,
  locale,
}: {
  relationship: DisplayRelationship;
  locale: AppLocale;
}) {
  const item = relationshipPresentation(locale, relationship);
  return (
    <span
      className={`relationship-pill relationship-pill--${relationship}`}
      title={item.description}
    >
      <i aria-hidden="true" />
      {item.label}
    </span>
  );
}

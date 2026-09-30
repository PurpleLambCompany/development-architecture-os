import type { ClientAcceptanceCriterionRow } from "@/domain/methodology/queries";
import { formatDate } from "@/lib/format";

/**
 * Agreed acceptance criteria as a client sees them (D20, D24): code, text and
 * when it applies. Whether a Review validated against it is shown only where
 * the client may already read that validation. Never the informing Standard.
 */
export function ClientCriteriaList({ criteria }: { criteria: ClientAcceptanceCriterionRow[] }) {
  if (criteria.length === 0) return null;
  return (
    <ul className="space-y-2 text-sm">
      {criteria.map((c) => (
        <li key={c.criterion_id} className="space-y-0.5">
          <p className="text-ink">
            <span className="font-mono text-xs text-ink-subtle">{c.reference_code}</span> {c.body}
          </p>
          <p className="text-xs text-ink-subtle">
            {c.state === "agreed" && c.agreed_on
              ? `Agreed, applies from ${formatDate(c.agreed_on)}`
              : "No longer in force"}
            {(c.validation_relationship_ids?.length ?? 0) > 0 ? " · Validated against" : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}

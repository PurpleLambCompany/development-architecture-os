import type { PracticeCountRow } from "@/domain/edge/queries";
import { EmptyState, Panel } from "@/components/ui/panel";

const TREATMENT_LABELS: Record<string, string> = {
  followed: "followed",
  adapted: "adapted",
  skipped: "skipped",
};

/** "3 of 7 (43%)" when n reaches the minimum; otherwise the count and n only (OD-5). */
function countWords(row: PracticeCountRow): string {
  const base = `${row.count} of ${row.n}`;
  return row.proportion === null ? base : `${base} (${Math.round(Number(row.proportion) * 100)}%)`;
}

function belowMinimum(n: number, minN: number): string {
  return `Fewer than ${minN} closed applications (n = ${n}); no proportion is shown.`;
}

/**
 * Practice counts for one Method Asset (Phase 7A narrow Practice
 * Intelligence, ADR-0059). Counts with their n, always; a proportion only at
 * the governed minimum of closed applications. The minimum avoids meaningless
 * small-sample proportions and is not a statistical claim. No engagement or
 * client is named, and nothing is scored or ranked.
 */
export function PracticeCountsPanel({ rows }: { rows: PracticeCountRow[] }) {
  const versions = [...new Map(rows.map((r) => [r.version_id, r.version_label])).entries()];
  const minN = rows[0]?.min_n ?? 5;
  return (
    <Panel
      title="In practice"
      description={`How this Method has been used across closed applications, as counts with their n. A proportion is shown only from ${minN} closed applications of a version; below that, only the count. Counts describe use; they do not rate the Method.`}
    >
      {rows.length === 0 ? (
        <EmptyState title="No closed applications of this Method yet" />
      ) : (
        <div className="space-y-6">
          {versions.map(([versionId, label]) => {
            const mine = rows.filter((r) => r.version_id === versionId);
            const stages = mine.filter((r) => r.measure === "stage_treatment");
            const coUse = mine.filter((r) => r.measure === "co_use");
            const standards = mine.filter((r) => r.measure === "standard_informs_criteria");
            const n = stages[0]?.n ?? coUse[0]?.n ?? null;
            const stageKeys = [...new Map(stages.map((r) => [r.stage_key, r])).values()].sort(
              (a, b) => (a.stage_ordinal ?? 0) - (b.stage_ordinal ?? 0),
            );
            return (
              <section key={versionId} className="space-y-3 text-sm">
                <h3 className="font-medium text-ink">
                  Version {label}
                  {n !== null ? (
                    <span className="ml-2 text-xs font-normal text-ink-subtle">
                      n = {n} closed {n === 1 ? "application" : "applications"}
                    </span>
                  ) : null}
                </h3>
                {n !== null && n < minN ? (
                  <p className="text-xs text-ink-muted">{belowMinimum(n, minN)}</p>
                ) : null}
                {stageKeys.length > 0 ? (
                  <div>
                    <p className="text-xs tracking-wide text-ink-subtle uppercase">
                      Stage treatment
                    </p>
                    <ul className="mt-1 divide-y divide-rule border-y border-rule">
                      {stageKeys.map((stage) => (
                        <li
                          key={stage.stage_key}
                          className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2"
                        >
                          <span className="text-ink">{stage.stage_title}</span>
                          {stages
                            .filter((r) => r.stage_key === stage.stage_key)
                            .map((r) => (
                              <span key={r.treatment} className="text-xs text-ink-muted">
                                {TREATMENT_LABELS[r.treatment ?? ""] ?? r.treatment} {countWords(r)}
                              </span>
                            ))}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {coUse.length > 0 ? (
                  <div>
                    <p className="text-xs tracking-wide text-ink-subtle uppercase">
                      Applied in the same engagement as
                    </p>
                    <ul className="mt-1 space-y-1">
                      {coUse.map((r) => (
                        <li key={r.other_version_id} className="text-ink-muted">
                          <span className="text-ink">{r.other_asset_title}</span>{" "}
                          {r.other_version_label}: {countWords(r)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {standards.map((r) => (
                  <p key={`std-${r.version_id}`} className="text-ink-muted">
                    Informs {r.count} agreed acceptance {r.count === 1 ? "criterion" : "criteria"}.
                  </p>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

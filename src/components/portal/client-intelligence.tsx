import Link from "next/link";
import { RECORD_KIND_PLURALS, RISK_SCALE, type RecordKind } from "@/domain/architecture/catalog";
import type { ClientArchitectureRow } from "@/domain/architecture/queries";
import { RECORD_KINDS } from "@/domain/architecture/vocabulary";
import { isTerminalStatus, recordStatus, snapshotStatus } from "@/domain/intelligence/catalog";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ReferenceCode } from "@/components/architecture/badges";
import { EmptyState, Panel } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status-tag";
import { Table, Td, Th } from "@/components/ui/table";

type Details = Record<string, unknown>;
const num = (d: Details, key: string) => (typeof d[key] === "number" ? (d[key] as number) : null);

/** Facts a client reads about a published record: only what its snapshot carries. */
function facts(kind: RecordKind, d: Details): string[] {
  switch (kind) {
    case "risk":
      return [`Probability ${num(d, "probability")} × impact ${num(d, "impact")}`];
    case "opportunity":
      return [
        `Value ${num(d, "value")} × feasibility ${num(d, "feasibility")}`,
        typeof d.window_closes_on === "string"
          ? `Window closes ${formatDate(d.window_closes_on)}`
          : "",
      ];
    case "dependency":
      return [d.blocking ? "Blocking" : ""];
    case "constraint":
      return [d.negotiable === false ? "Non-negotiable" : ""];
    case "decision":
      return [typeof d.needed_by === "string" ? `Needed by ${formatDate(d.needed_by)}` : ""];
    default:
      return [];
  }
}

/**
 * Published Project Intelligence records, by kind, with each record's status
 * as published. The risk grid is shown to holders of view_full_architecture.
 */
export function ClientIntelligence({
  slug,
  records,
  seesRiskGrid,
}: {
  slug: string;
  records: ClientArchitectureRow[];
  seesRiskGrid: boolean;
}) {
  const kinds = RECORD_KINDS.filter((k) => records.some((r) => r.kind === k));
  const href = (id: string) => `/portal/${slug}/architecture/${id}`;
  const openRisks = records.filter((r) => {
    if (r.kind !== "risk") return false;
    return !isTerminalStatus("risk", snapshotStatus("risk", r.client_snapshot.details ?? {}));
  });
  return (
    <>
      {seesRiskGrid && openRisks.length > 0 ? (
        <Panel
          title="Risk grid"
          description="Open risks as published, by probability (rows) and impact (columns)."
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="w-28 px-2 py-1 text-left font-medium text-ink-subtle">
                    Probability ↓ Impact →
                  </th>
                  {RISK_SCALE.map((i) => (
                    <th key={i} className="px-2 py-1 text-center font-medium text-ink-subtle">
                      {i}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...RISK_SCALE].reverse().map((p) => (
                  <tr key={p}>
                    <th className="px-2 py-1 text-left font-medium text-ink-subtle">{p}</th>
                    {RISK_SCALE.map((i) => (
                      <td
                        key={i}
                        className={cn(
                          "h-14 border border-rule px-2 py-1 align-top",
                          p * i >= 15 ? "bg-negative-soft" : p * i >= 8 ? "bg-attention-soft" : "",
                        )}
                      >
                        {openRisks
                          .filter((r) => {
                            const d = r.client_snapshot.details ?? {};
                            return num(d, "probability") === p && num(d, "impact") === i;
                          })
                          .map((r) => (
                            <Link
                              key={r.element_id}
                              href={href(r.element_id)}
                              className="block hover:underline"
                            >
                              <ReferenceCode code={r.reference_code} />{" "}
                              <span className="text-ink">{r.title}</span>
                            </Link>
                          ))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
      <Panel
        title="Project Intelligence"
        description="Assumptions, risks, constraints, dependencies, decisions, recommendations and opportunities shared with you, each as last published."
      >
        {kinds.length === 0 ? (
          <EmptyState title="Nothing published yet" />
        ) : (
          <div className="space-y-6">
            {kinds.map((kind) => (
              <section key={kind} aria-label={RECORD_KIND_PLURALS[kind]}>
                <h3 className="mb-2 text-xs tracking-wide text-ink-subtle uppercase">
                  {RECORD_KIND_PLURALS[kind]}
                </h3>
                <Table>
                  <thead>
                    <tr>
                      <Th>Record</Th>
                      <Th>Status as published</Th>
                      <Th>Version</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {records
                      .filter((r) => r.kind === kind)
                      .map((r) => {
                        const d = r.client_snapshot.details ?? {};
                        const status = recordStatus(kind, snapshotStatus(kind, d));
                        return (
                          <tr key={r.element_id}>
                            <Td>
                              <Link
                                href={href(r.element_id)}
                                className="group inline-flex items-baseline gap-2"
                              >
                                <ReferenceCode code={r.reference_code} />
                                <span className="text-ink group-hover:underline">{r.title}</span>
                              </Link>
                              {r.client_snapshot.summary ? (
                                <p className="mt-1 text-xs text-ink-muted">
                                  {r.client_snapshot.summary}
                                </p>
                              ) : null}
                            </Td>
                            <Td>
                              <span className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                                {status ? (
                                  <StatusTag tone={status.tone}>{status.label}</StatusTag>
                                ) : null}
                                {facts(kind, d)
                                  .filter(Boolean)
                                  .map((f) => (
                                    <span key={f}>{f}</span>
                                  ))}
                              </span>
                            </Td>
                            <Td className="text-xs whitespace-nowrap text-ink-muted">
                              v{r.version_no} · {formatDate(r.published_at.slice(0, 10))}
                            </Td>
                          </tr>
                        );
                      })}
                  </tbody>
                </Table>
              </section>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}

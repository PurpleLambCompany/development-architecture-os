import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import {
  DOMAINS,
  DOMAIN_LABELS,
  DOMAIN_SLUGS,
  domainFromSlug,
  DOMAIN_QUESTIONS,
  PROVENANCE_CLIENT_LABELS,
  RECORD_KIND_LABELS,
  approvalState,
  type RecordKind,
} from "@/domain/architecture/catalog";
import { getClientArchitectureContext } from "@/domain/architecture/context";
import { attributeValue } from "@/domain/architecture/object-types";
import {
  getClientArchitecture,
  getClientRelationships,
  getDomainStates,
  type ClientArchitectureRow,
} from "@/domain/architecture/queries";
import { objectType, type ObjectTypeKey } from "@/domain/architecture/rules";
import { formatDate } from "@/lib/format";
import { ApprovalTag, MaturityMark, ReferenceCode } from "@/components/architecture/badges";
import { DomainViews } from "@/components/architecture/domain-views";
import { clientArchitectureModel } from "@/components/portal/client-model";
import { ClientIntelligence } from "@/components/portal/client-intelligence";
import { EngagementNav } from "@/components/portal/engagement-nav";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";
import { Table, Td, Th } from "@/components/ui/table";

/**
 * The client's Architecture area: published, client-visible versions only,
 * read from immutable snapshots. Working copies, internal statements and
 * relationships, Method lineage and unreviewed AI never reach this page;
 * the database returns nothing else to a client.
 */
export default async function ClientArchitecturePage({
  params,
  searchParams,
}: PageProps<"/portal/[slug]/architecture">) {
  const { slug } = await params;
  const focus = domainFromSlug(String((await searchParams).domain ?? ""));
  const { engagement, canView, capabilities } = await getClientArchitectureContext(slug);
  if (!canView) notFound();
  const [rows, states, relationships] = await Promise.all([
    getClientArchitecture(engagement.id),
    getDomainStates(engagement.id),
    getClientRelationships(engagement.id),
  ]);
  const records = rows.filter((r) => r.kind !== "object");
  const model = clientArchitectureModel(rows, relationships);
  const base = `/portal/${slug}/architecture`;

  return (
    <div className="space-y-8">
      <EngagementNav slug={slug} engagementId={engagement.id} current="architecture" />
      <PageHeader
        eyebrow={engagement.organizations?.name ?? "Architecture"}
        title="Architecture"
        description="The published architecture of your engagement, domain by domain. Each item shows its latest published version; approval status is shown for information and never limits what you can see."
      />

      <nav className="flex flex-wrap gap-2" aria-label="Domains">
        {[null, ...DOMAINS].map((d) => (
          <Link
            key={d ?? "all"}
            href={d ? `${base}?domain=${DOMAIN_SLUGS[d]}` : base}
            aria-current={d === focus ? "page" : undefined}
            className={
              d === focus
                ? "rounded-sm border border-accent bg-accent-soft px-3 py-1.5 text-sm text-accent"
                : "rounded-sm border border-rule px-3 py-1.5 text-sm text-ink-muted hover:text-ink"
            }
          >
            {d ? DOMAIN_LABELS[d] : "All domains"}
          </Link>
        ))}
      </nav>

      {(focus ? [focus] : DOMAINS).map((domain) => {
        const objects = rows.filter((r) => r.kind === "object" && r.domain === domain);
        const state = states.find((s) => s.domain === domain);
        return (
          <Fragment key={domain}>
            <Panel
              title={DOMAIN_LABELS[domain]}
              description={DOMAIN_QUESTIONS[domain]}
              actions={
                <span className="flex items-center gap-3">
                  {state ? <MaturityMark maturity={state.maturity} /> : null}
                  {focus ? null : (
                    <Link
                      href={`${base}?domain=${DOMAIN_SLUGS[domain]}`}
                      className="text-sm text-ink-muted hover:underline"
                    >
                      Domain views
                    </Link>
                  )}
                </span>
              }
            >
              <div className="space-y-4">
                {state ? (
                  <p className="text-sm text-ink-muted">
                    {state.rationale}{" "}
                    <span className="text-xs text-ink-subtle">
                      {PROVENANCE_CLIENT_LABELS.architect_judgment},{" "}
                      {formatDate(state.assessed_at.slice(0, 10))}
                    </span>
                  </p>
                ) : null}
                {objects.length === 0 ? (
                  <EmptyState title="Nothing published in this domain yet" />
                ) : (
                  <ElementTable slug={slug} rows={objects} />
                )}
              </div>
            </Panel>
            {focus ? (
              <DomainViews
                domain={domain}
                linkBase={base}
                objects={model.architecture.elements.filter((e) => e.object?.domain === domain)}
                architecture={model.architecture}
                graph={model.graph}
              />
            ) : null}
          </Fragment>
        );
      })}

      {focus ? null : (
        <ClientIntelligence
          slug={slug}
          records={records}
          seesRiskGrid={capabilities.has("view_full_architecture")}
        />
      )}
    </div>
  );
}

function typeLabel(row: ClientArchitectureRow) {
  if (row.kind === "object") return objectType(row.object_type)?.label ?? "";
  return RECORD_KIND_LABELS[row.kind as RecordKind];
}

function detailOf(row: ClientArchitectureRow): string | null {
  if (row.kind !== "object") return null;
  const type = row.object_type as ObjectTypeKey;
  const attributes = row.client_snapshot.details?.attributes;
  if (type === "capability") {
    return (
      [
        attributeValue(type, attributes, "tier"),
        attributeValue(type, attributes, "current_readiness"),
      ]
        .filter(Boolean)
        .join(" · ") || null
    );
  }
  return null;
}

function ElementTable({ slug, rows }: { slug: string; rows: ClientArchitectureRow[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Item</Th>
          <Th>Type</Th>
          <Th>Version</Th>
          <Th>Status</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.element_id}>
            <Td>
              <Link
                href={`/portal/${slug}/architecture/${row.element_id}`}
                className="group inline-flex items-baseline gap-2"
              >
                <ReferenceCode code={row.reference_code} />
                <span className="text-ink group-hover:underline">{row.title}</span>
              </Link>
              {row.client_snapshot.summary ? (
                <p className="mt-1 text-xs text-ink-muted">{row.client_snapshot.summary}</p>
              ) : null}
              {detailOf(row) ? (
                <p className="mt-1 text-xs text-ink-subtle">{detailOf(row)}</p>
              ) : null}
            </Td>
            <Td className="whitespace-nowrap text-ink-muted">{typeLabel(row)}</Td>
            <Td className="text-xs whitespace-nowrap text-ink-muted">
              v{row.version_no} · {formatDate(row.published_at.slice(0, 10))}
            </Td>
            <Td>
              <span className="flex flex-col items-start gap-1">
                {approvalState(row.approval_state) === "not_requested" ? (
                  <span className="text-xs text-ink-subtle">Published</span>
                ) : (
                  <ApprovalTag state={approvalState(row.approval_state)} />
                )}
                {row.latest_approved_version_no &&
                row.latest_approved_version_no !== row.version_no ? (
                  <span className="text-xs text-ink-subtle">
                    v{row.latest_approved_version_no} approved
                  </span>
                ) : null}
              </span>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

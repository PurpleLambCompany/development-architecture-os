import Link from "next/link";
import { createRecord } from "@/domain/architecture/actions";
import { promoteEdgeItem } from "@/domain/edge/actions";
import { edgeRuleLabel } from "@/domain/edge/rules";
import { RECORD_KIND_LABELS, type RecordKind } from "@/domain/architecture/catalog";
import { getInternalArchitectureContext, memberNames } from "@/domain/architecture/context";
import { RECORD_KINDS } from "@/domain/architecture/vocabulary";
import { getClientActions, getContributions } from "@/domain/intelligence/queries";
import { parseRegisterFilters, registerQuery } from "@/domain/intelligence/register";
import { loadEngagementRegister } from "@/domain/intelligence/views";
import { ArchitectureNav } from "@/components/architecture/architecture-nav";
import {
  newElementDefaults,
  newRecordDefaults,
  recordFields,
  spineFields,
} from "@/components/architecture/element-fields";
import { elementOptionLabel } from "@/components/architecture/relationships-panel";
import { CountGrid } from "@/components/intelligence/figures";
import { IntelligenceNav } from "@/components/intelligence/intelligence-nav";
import {
  KindTabs,
  OpportunityGrid,
  RegisterFilterForm,
  RegisterTable,
  RiskGrid,
} from "@/components/intelligence/register-view";
import { ActionForm } from "@/components/ui/action-form";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";

export default async function IntelligencePage({
  params,
  searchParams,
}: PageProps<"/internal/engagements/[slug]/intelligence">) {
  const { slug } = await params;
  const query = await searchParams;
  const filters = parseRegisterFilters(query);
  const { engagement, canEdit, canPublish } = await getInternalArchitectureContext(slug);
  const [register, actions, contributions] = await Promise.all([
    loadEngagementRegister(engagement.id, filters),
    getClientActions(engagement.id),
    getContributions(engagement.id),
  ]);
  const { architecture, counts, shown } = register;
  const base = `/internal/engagements/${slug}/intelligence`;
  const here = (extra: Partial<typeof filters>) => {
    const q = registerQuery({ ...filters, ...extra });
    return q ? `${base}?${q}` : base;
  };
  const creating =
    (RECORD_KINDS as readonly string[]).includes(String(query.new)) && canEdit
      ? (query.new as RecordKind)
      : null;
  // Promotion from the Development Edge (ADR-0057): the new record is an
  // ordinary governed record; the Edge item is judged "promoted" to it.
  const param = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : null);
  const promoting =
    creating &&
    param("promoteRule") &&
    param("promoteType") &&
    param("promoteId") &&
    param("promoteFp")
      ? {
          ruleKey: param("promoteRule")!,
          subjectType: param("promoteType")!,
          subjectId: param("promoteId")!,
          fingerprint: param("promoteFp")!,
        }
      : null;
  const promotedFrom = promoting
    ? [edgeRuleLabel(promoting.ruleKey), architecture.byId.get(promoting.subjectId)?.reference_code]
        .filter(Boolean)
        .join(": ")
    : null;
  const live = architecture.elements.filter(
    (e) => e.lifecycle !== "retired" && e.lifecycle !== "superseded",
  );
  const name = memberNames(engagement);
  const owners = engagement.engagement_members
    .filter((m) => m.side === "internal" && m.status === "active")
    .map((m) => ({ value: m.user_id, label: name(m.user_id) }));
  const recordHref = (row: { element_id: string }) =>
    `/internal/engagements/${slug}/architecture/elements/${row.element_id}`;
  const openRequests = actions.filter((a) => a.status === "open" || a.status === "responded");
  const newInput = contributions.filter((c) => c.status === "received");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={[engagement.title, "Project Intelligence"].join(" · ")}
        title="Project Intelligence"
        description="Assumptions, risks, constraints, dependencies, decisions, recommendations and opportunities, with their stewardship, the client's requests and input, and the signals that need judgment."
      />
      <ArchitectureNav slug={slug} current="intelligence" />
      <IntelligenceNav
        slug={slug}
        current="registers"
        counts={{
          requests: openRequests.length,
          input: newInput.length,
          signals: register.signals.length,
        }}
      />

      <CountGrid
        label="Needs judgment"
        items={[
          { label: "Untriaged", value: counts.untriaged, href: here({ triage: "untriaged" }) },
          { label: "Critical", value: counts.critical, href: here({ attention: "critical" }) },
          { label: "Escalated", value: counts.escalated, href: here({ escalated: true }) },
          {
            label: "Reviews overdue",
            value: counts.reviewsOverdue,
            href: here({ review: "overdue" }),
          },
          { label: "Open signals", value: register.signals.length, href: `${base}/signals` },
        ]}
      />

      <KindTabs base={base} filters={filters} counts={counts.byKind} />
      <RegisterFilterForm
        base={base}
        filters={filters}
        owners={owners}
        elements={live
          .filter((e) => !register.recordIds.has(e.id))
          .map((e) => ({ value: e.id, label: elementOptionLabel(e) }))}
      />

      {canEdit ? (
        creating ? (
          <Panel
            title={`New ${RECORD_KIND_LABELS[creating].toLowerCase()}`}
            description={
              promotedFrom
                ? `Promoted from the Development Edge (${promotedFrom}). The item is marked promoted once this record is created.`
                : undefined
            }
          >
            <ActionForm
              fields={[
                ...spineFields(canPublish, { recommendation: creating === "recommendation" }),
                ...recordFields(
                  creating,
                  live.map((e) => ({ value: e.id, label: elementOptionLabel(e) })),
                ),
              ]}
              defaultValues={{
                ...newElementDefaults,
                ...newRecordDefaults[creating],
                ...(creating === "dependency" && live.length > 1
                  ? { fromElementId: live[0]!.id, toElementId: live[1]!.id }
                  : {}),
                ...(promotedFrom
                  ? { summary: `Raised from the Development Edge: ${promotedFrom}.` }
                  : {}),
              }}
              action={
                promoting
                  ? promoteEdgeItem.bind(null, engagement.id, slug, creating, promoting)
                  : createRecord.bind(null, engagement.id, creating)
              }
              submitLabel={`Create ${RECORD_KIND_LABELS[creating].toLowerCase()}`}
            />
            <Link
              href={here({})}
              className="mt-3 inline-block text-sm text-ink-muted hover:underline"
            >
              Cancel
            </Link>
          </Panel>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(filters.kind ? [filters.kind] : RECORD_KINDS).map((k) => (
              <ButtonLink
                key={k}
                href={`${here({})}${here({}).includes("?") ? "&" : "?"}new=${k}`}
                size="sm"
                variant={filters.kind ? "primary" : "secondary"}
              >
                New {RECORD_KIND_LABELS[k].toLowerCase()}
              </ButtonLink>
            ))}
          </div>
        )
      ) : null}

      {filters.kind === "risk" ? <RiskGrid rows={register.rows} recordHref={recordHref} /> : null}
      {filters.kind === "opportunity" ? (
        <OpportunityGrid rows={register.rows} recordHref={recordHref} />
      ) : null}

      <RegisterTable
        rows={shown}
        filters={filters}
        recordHref={recordHref}
        today={register.today}
        canTriage={() => canEdit}
        signalCounts={register.signalCounts}
      />
    </div>
  );
}

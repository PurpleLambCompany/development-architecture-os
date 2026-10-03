import Link from "next/link";
import { notFound } from "next/navigation";
import { createObject } from "@/domain/architecture/actions";
import {
  DOMAIN_LABELS,
  DOMAIN_QUESTIONS,
  DOMAIN_SLUGS,
  domainFromSlug,
} from "@/domain/architecture/catalog";
import { getInternalArchitectureContext } from "@/domain/architecture/context";
import { getDomainStates, loadArchitecture, objectsIn } from "@/domain/architecture/queries";
import { objectTypesIn, type ObjectTypeKey } from "@/domain/architecture/rules";
import { getElementRevisions } from "@/domain/edge/queries";
import { formatDate } from "@/lib/format";
import { ArchitectureNav } from "@/components/architecture/architecture-nav";
import { MaturityMark } from "@/components/architecture/badges";
import { DomainViews, viewGraph } from "@/components/architecture/domain-views";
import {
  newElementDefaults,
  objectFields,
  spineFields,
} from "@/components/architecture/element-fields";
import { ObjectRegisterTable } from "@/components/architecture/object-register";
import { ActionForm } from "@/components/ui/action-form";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";

export default async function DomainWorkspacePage({
  params,
  searchParams,
}: PageProps<"/internal/engagements/[slug]/architecture/[domain]">) {
  const { slug, domain: domainSlug } = await params;
  const query = await searchParams;
  const domain = domainFromSlug(domainSlug);
  if (!domain) notFound();
  const { engagement, canEdit, canPublish } = await getInternalArchitectureContext(slug);
  const [architecture, states, revisions] = await Promise.all([
    loadArchitecture(engagement.id),
    getDomainStates(engagement.id),
    getElementRevisions(engagement.id),
  ]);
  const state = states.find((s) => s.domain === domain);
  // A fact beside the judgment, never a judgment (ADR-0019): substantive
  // revisions of this domain's objects published after its latest assessment.
  const revisedSince = state
    ? revisions.filter(
        (r) =>
          r.change_type === "substantive_revision" &&
          r.published_at > state.assessed_at &&
          architecture.byId.get(r.element_id)?.object?.domain === domain,
      ).length
    : 0;
  const types = objectTypesIn(domain);
  const objects = objectsIn(architecture, domain).filter(
    (o) => query.show === "all" || (o.lifecycle !== "retired" && o.lifecycle !== "superseded"),
  );
  const graph = viewGraph(architecture);
  const newType = types.find((t) => t.key === query.new);
  const here = `/internal/engagements/${slug}/architecture/${DOMAIN_SLUGS[domain]}`;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={[engagement.title, "Architecture"].join(" · ")}
        title={DOMAIN_LABELS[domain]}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <span>{DOMAIN_QUESTIONS[domain]}</span>
            {state ? (
              <>
                <MaturityMark maturity={state.maturity} />
                <span className="text-xs text-ink-subtle">
                  assessed {formatDate(state.assessed_at.slice(0, 10))}
                </span>
                <span className="text-xs text-ink-subtle">
                  {revisedSince === 0
                    ? "No substantive revisions since"
                    : `Revised since the latest judgment: ${revisedSince} substantive ${revisedSince === 1 ? "revision" : "revisions"}`}
                </span>
              </>
            ) : (
              <span className="text-xs text-ink-subtle">No domain assessment yet</span>
            )}
          </span>
        }
      />
      <ArchitectureNav slug={slug} current={domain} />

      {canEdit ? (
        <Panel title="Add to this domain">
          {newType ? (
            <div className="space-y-3">
              <p className="text-sm text-ink-muted">
                <span className="font-medium text-ink">{newType.label}.</span> {newType.definition}
              </p>
              <ActionForm
                fields={[...spineFields(canPublish), ...objectFields(newType.key as ObjectTypeKey)]}
                defaultValues={{ ...newElementDefaults, objectType: newType.key }}
                action={async (input) => {
                  "use server";
                  return createObject(engagement.id, { ...input, objectType: newType.key });
                }}
                submitLabel={`Create ${newType.label.toLowerCase()}`}
              />
              <Link href={here} className="text-sm text-ink-muted hover:underline">
                Cancel
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {types.map((t) => (
                <ButtonLink
                  key={t.key}
                  href={`${here}?new=${t.key}`}
                  variant="secondary"
                  size="sm"
                  title={t.definition}
                >
                  {t.label}
                </ButtonLink>
              ))}
            </div>
          )}
        </Panel>
      ) : null}

      <DomainViews
        domain={domain}
        linkBase={`/internal/engagements/${slug}/architecture/elements`}
        objects={objects}
        architecture={architecture}
        graph={graph}
      />

      <Panel
        title="All objects"
        description="Every object in this domain, with its lifecycle, maturity and approval state."
        actions={
          <Link
            href={query.show === "all" ? here : `${here}?show=all`}
            className="text-sm text-ink-muted hover:underline"
          >
            {query.show === "all" ? "Hide retired" : "Include retired and superseded"}
          </Link>
        }
      >
        <ObjectRegisterTable
          slug={slug}
          canEdit={canEdit}
          canPublish={canPublish}
          rows={objects.map((o) => ({
            id: o.id,
            kind: o.kind,
            referenceCode: o.reference_code,
            title: o.title,
            internal: o.client_visibility === "internal",
            typeLabel:
              types.find((t) => t.key === o.object!.object_type)?.label ?? o.object!.object_type,
            lifecycle: o.lifecycle,
            maturity: o.object!.maturity,
            versionNo: o.latestVersion?.version_no ?? null,
            approvalState: o.latestVersion ? o.latestApprovalState : null,
          }))}
        />
      </Panel>
    </div>
  );
}

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
import { formatDate } from "@/lib/format";
import { ArchitectureNav } from "@/components/architecture/architecture-nav";
import {
  ApprovalTag,
  ElementLink,
  InternalMark,
  LifecycleTag,
  MaturityMark,
} from "@/components/architecture/badges";
import { DomainViews, viewGraph } from "@/components/architecture/domain-views";
import {
  newElementDefaults,
  objectFields,
  spineFields,
} from "@/components/architecture/element-fields";
import { ActionForm } from "@/components/ui/action-form";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";
import { Table, Td, Th } from "@/components/ui/table";

export default async function DomainWorkspacePage({
  params,
  searchParams,
}: PageProps<"/internal/engagements/[slug]/architecture/[domain]">) {
  const { slug, domain: domainSlug } = await params;
  const query = await searchParams;
  const domain = domainFromSlug(domainSlug);
  if (!domain) notFound();
  const { engagement, canEdit, canPublish } = await getInternalArchitectureContext(slug);
  const [architecture, states] = await Promise.all([
    loadArchitecture(engagement.id),
    getDomainStates(engagement.id),
  ]);
  const state = states.find((s) => s.domain === domain);
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
        {objects.length === 0 ? (
          <EmptyState title="No objects yet" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Object</Th>
                <Th>Type</Th>
                <Th>Lifecycle</Th>
                <Th>Maturity</Th>
                <Th>Approval</Th>
              </tr>
            </thead>
            <tbody>
              {objects.map((o) => (
                <tr key={o.id}>
                  <Td>
                    <span className="flex flex-wrap items-center gap-2">
                      <ElementLink slug={slug} element={o} />
                      {o.client_visibility === "internal" ? <InternalMark /> : null}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap text-ink-muted">
                    {types.find((t) => t.key === o.object!.object_type)?.label}
                  </Td>
                  <Td>
                    <LifecycleTag lifecycle={o.lifecycle} />
                  </Td>
                  <Td className="whitespace-nowrap">
                    <MaturityMark maturity={o.object!.maturity} />
                  </Td>
                  <Td>
                    {o.latestVersion ? (
                      <span className="flex items-center gap-2 text-xs text-ink-muted">
                        v{o.latestVersion.version_no}
                        <ApprovalTag state={o.latestApprovalState} />
                      </span>
                    ) : (
                      <span className="text-xs text-ink-subtle">Unpublished</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  );
}

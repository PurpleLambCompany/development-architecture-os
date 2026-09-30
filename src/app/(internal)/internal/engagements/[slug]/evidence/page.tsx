import { createEvidenceSource, updateEvidenceSource } from "@/domain/architecture/actions";
import {
  EVIDENCE_PROVENANCE,
  EVIDENCE_SOURCE_TYPES,
  EVIDENCE_SOURCE_TYPE_LABELS,
  EVIDENCE_STANCE_LABELS,
  IP_CLASSIFICATIONS,
  IP_CLASSIFICATION_LABELS,
  PROVENANCE_LABELS,
} from "@/domain/architecture/catalog";
import { getInternalArchitectureContext } from "@/domain/architecture/context";
import { listEvidence, loadArchitecture, type LoadedEvidence } from "@/domain/architecture/queries";
import { formatDate } from "@/lib/format";
import { ArchitectureNav } from "@/components/architecture/architecture-nav";
import { ElementLink, InternalMark } from "@/components/architecture/badges";
import { getEvidenceFiles } from "@/domain/intelligence/queries";
import { FileList } from "@/components/intelligence/file-list";
import { EvidenceFileUpload } from "@/components/intelligence/upload-form";
import { ActionForm, type FieldSpec } from "@/components/ui/action-form";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";

function sourceFields(canPublish: boolean): FieldSpec[] {
  return [
    { name: "title", label: "Title", wide: true },
    {
      name: "sourceType",
      label: "Type",
      type: "select",
      options: EVIDENCE_SOURCE_TYPES.map((t) => ({
        value: t,
        label: EVIDENCE_SOURCE_TYPE_LABELS[t],
      })),
    },
    {
      name: "provenance",
      label: "Provenance",
      type: "select",
      options: EVIDENCE_PROVENANCE.map((p) => ({ value: p, label: PROVENANCE_LABELS[p] })),
    },
    { name: "publisherAuthor", label: "Publisher or author" },
    { name: "sourceDate", label: "Source date", type: "date" },
    { name: "reference", label: "Citation", wide: true },
    { name: "url", label: "Link", type: "url", hint: "https:// only." },
    { name: "accessedDate", label: "Accessed", type: "date" },
    { name: "externalReference", label: "External reference", hint: "Document or file location." },
    {
      name: "ipClassification",
      label: "IP classification",
      type: "select",
      options: IP_CLASSIFICATIONS.map((c) => ({ value: c, label: IP_CLASSIFICATION_LABELS[c] })),
    },
    ...(canPublish
      ? [
          {
            name: "clientVisibility",
            label: "Citable to clients",
            type: "select" as const,
            options: [
              { value: "internal", label: "No, internal only" },
              { value: "client", label: "Yes, may appear in client snapshots" },
            ],
          },
        ]
      : []),
    { name: "summary", label: "Summary", type: "textarea" },
    { name: "notes", label: "Internal notes", type: "textarea" },
  ];
}

function sourceDefaults(s: LoadedEvidence) {
  return {
    title: s.title,
    sourceType: s.source_type,
    provenance: s.provenance,
    publisherAuthor: s.publisher_author,
    sourceDate: s.source_date ?? "",
    reference: s.reference,
    url: s.url ?? "",
    accessedDate: s.accessed_date ?? "",
    externalReference: s.external_reference,
    ipClassification: s.ip_classification,
    clientVisibility: s.client_visibility,
    summary: s.summary,
    notes: s.notes,
  };
}

/**
 * The evidence library: a separate source system. Sources are cited by
 * statements (and elements), never copied into them. Clients see a source
 * only inside a published snapshot, and only when it is marked citable.
 */
export default async function EvidencePage({
  params,
}: PageProps<"/internal/engagements/[slug]/evidence">) {
  const { slug } = await params;
  const { engagement, canEdit, canPublish } = await getInternalArchitectureContext(slug);
  const [sources, architecture, files] = await Promise.all([
    listEvidence(engagement.id),
    loadArchitecture(engagement.id),
    getEvidenceFiles(engagement.id),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={[engagement.title, "Evidence"].join(" · ")}
        title="Evidence library"
        description="Sources, their provenance and citation, and the statements that rely on them."
      />
      <ArchitectureNav slug={slug} current="evidence" />

      {canEdit ? (
        <ActionForm
          fields={sourceFields(canPublish)}
          defaultValues={{
            sourceType: "document",
            provenance: "client_source",
            ipClassification: "client_confidential",
            clientVisibility: "internal",
          }}
          action={createEvidenceSource.bind(null, engagement.id)}
          submitLabel="Add source"
          trigger="Add evidence source"
        />
      ) : null}

      {sources.length === 0 ? (
        <Panel>
          <EmptyState title="No evidence sources yet" />
        </Panel>
      ) : (
        <div className="space-y-4">
          {sources.map((s) => {
            const citedBy = s.statementLinks.map((l) => ({
              link: l,
              element: l.architecture_statements
                ? architecture.byId.get(l.architecture_statements.element_id)
                : undefined,
            }));
            return (
              <Panel
                key={s.id}
                title={s.title}
                description={[
                  EVIDENCE_SOURCE_TYPE_LABELS[s.source_type],
                  PROVENANCE_LABELS[s.provenance],
                  s.publisher_author,
                  s.source_date ? formatDate(s.source_date) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                actions={s.client_visibility === "internal" ? <InternalMark /> : null}
              >
                <div className="space-y-3 text-sm">
                  {s.summary ? <p className="text-ink">{s.summary}</p> : null}
                  <p className="text-xs text-ink-muted">
                    {[
                      s.reference,
                      s.url,
                      s.external_reference,
                      IP_CLASSIFICATION_LABELS[s.ip_classification],
                      s.accessed_date ? `accessed ${formatDate(s.accessed_date)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {s.notes ? <p className="text-xs text-ink-muted">Notes: {s.notes}</p> : null}
                  <div>
                    <p className="mb-1 text-xs tracking-wide text-ink-subtle uppercase">
                      Cited by {citedBy.length + s.elementLinks.length}
                    </p>
                    <ul className="space-y-1">
                      {citedBy.map(({ link, element }) => (
                        <li key={link.id} className="text-xs text-ink-muted">
                          <span className="text-ink-subtle">
                            {EVIDENCE_STANCE_LABELS[link.stance]}:
                          </span>{" "}
                          {element ? <ElementLink slug={slug} element={element} /> : null}
                          {link.architecture_statements ? (
                            <span> · “{link.architecture_statements.body}”</span>
                          ) : null}
                        </li>
                      ))}
                      {s.elementLinks.map((link) => {
                        const element = architecture.byId.get(link.element_id);
                        return (
                          <li key={link.id} className="text-xs text-ink-muted">
                            <span className="text-ink-subtle">
                              {EVIDENCE_STANCE_LABELS[link.stance]}:
                            </span>{" "}
                            {element ? <ElementLink slug={slug} element={element} /> : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs tracking-wide text-ink-subtle uppercase">Files</p>
                    <FileList files={files.filter((f) => f.evidence_source_id === s.id)} />
                    {canEdit ? (
                      <div className="mt-2">
                        <EvidenceFileUpload engagementId={engagement.id} evidenceSourceId={s.id} />
                      </div>
                    ) : null}
                  </div>
                  {canEdit ? (
                    <ActionForm
                      fields={sourceFields(canPublish)}
                      defaultValues={sourceDefaults(s)}
                      action={updateEvidenceSource.bind(null, s.id)}
                      submitLabel="Save source"
                      trigger="Edit"
                    />
                  ) : null}
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}

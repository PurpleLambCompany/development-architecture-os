import {
  createDevelopmentContext,
  retireDevelopmentContext,
  reviseDevelopmentContext,
} from "@/domain/methodology/actions";
import { getDevelopmentContexts, getMyPracticeCapabilities } from "@/domain/methodology/queries";
import { requireInternal } from "@/lib/auth/viewer";
import { formatDate } from "@/lib/format";
import { LibraryNav } from "@/components/methodology/library-nav";
import { ActionForm } from "@/components/ui/action-form";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status-tag";

/**
 * Development Contexts (§29.4): a governed, internal classification of the
 * kind of development an engagement is. Defined, redefined (with a reason
 * and history) and retired by publish_methodology holders. Never shown to
 * clients.
 */
export default async function DevelopmentContextsPage() {
  await requireInternal();
  const [contexts, practice] = await Promise.all([
    getDevelopmentContexts(),
    getMyPracticeCapabilities(),
  ]);
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Method Library"
        title="Development Contexts"
        description="The kinds of development TPLCo works in. Engagements declare theirs; asset versions declare where they apply. Internal only."
      />
      <LibraryNav current="contexts" />
      <Panel
        title={`${contexts.length} ${contexts.length === 1 ? "context" : "contexts"}`}
        actions={
          practice.canPublish ? (
            <ActionForm
              trigger="Define a context"
              submitLabel="Define"
              action={createDevelopmentContext}
              fields={[
                { name: "label", label: "Label" },
                {
                  name: "key",
                  label: "Key",
                  hint: "Lowercase and underscores, e.g. regional_cluster",
                },
                { name: "definition", label: "Definition", type: "textarea" },
              ]}
            />
          ) : null
        }
      >
        {contexts.length === 0 ? (
          <EmptyState title="No Development Contexts yet">
            They are defined here, deliberately, rather than seeded by migration.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-rule">
            {contexts.map((c) => {
              const revisions = [...(c.development_context_revisions ?? [])].sort((a, b) =>
                b.revised_at.localeCompare(a.revised_at),
              );
              return (
                <li key={c.id} className="space-y-2 py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-serif text-base text-ink">{c.label}</span>
                    <span className="font-mono text-xs text-ink-subtle">{c.key}</span>
                    {c.status !== "active" ? <StatusTag tone="negative">Retired</StatusTag> : null}
                  </div>
                  <p className="text-sm text-ink-muted">{c.definition}</p>
                  {revisions.length > 0 ? (
                    <details className="text-sm text-ink-muted">
                      <summary className="cursor-pointer">
                        Revision history ({revisions.length})
                      </summary>
                      <ul className="mt-2 space-y-2">
                        {revisions.map((r) => (
                          <li key={r.id}>
                            <span className="text-ink-subtle">{formatDate(r.revised_at)}</span> ·{" "}
                            {r.reason}
                            <p className="text-ink-subtle">
                              Was: {r.prior_label}: {r.prior_definition}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                  {practice.canPublish && c.status === "active" ? (
                    <div className="flex flex-wrap gap-2">
                      <ActionForm
                        trigger="Revise"
                        submitLabel="Save revision"
                        action={reviseDevelopmentContext.bind(null, c.id)}
                        fields={[
                          { name: "label", label: "Label" },
                          { name: "definition", label: "Definition", type: "textarea" },
                          { name: "reason", label: "Reason", type: "textarea" },
                        ]}
                        defaultValues={{ label: c.label, definition: c.definition }}
                      />
                      <ActionForm
                        trigger="Retire"
                        variant="danger"
                        submitLabel="Retire"
                        action={retireDevelopmentContext.bind(null, c.id)}
                        fields={[{ name: "reason", label: "Reason", type: "textarea" }]}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

import Link from "next/link";
import { createBaseline } from "@/domain/architecture/actions";
import { BASELINE_STATUS, approvalState } from "@/domain/architecture/catalog";
import { getInternalArchitectureContext } from "@/domain/architecture/context";
import { listBaselines, loadArchitecture } from "@/domain/architecture/queries";
import { formatDateTime } from "@/lib/format";
import { ArchitectureNav } from "@/components/architecture/architecture-nav";
import { ApprovalTag } from "@/components/architecture/badges";
import { ActionForm } from "@/components/ui/action-form";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status-tag";
import { Table, Td, Th } from "@/components/ui/table";

export default async function BaselinesPage({
  params,
}: PageProps<"/internal/engagements/[slug]/baselines">) {
  const { slug } = await params;
  const { engagement, canEdit } = await getInternalArchitectureContext(slug);
  const [baselines, architecture] = await Promise.all([
    listBaselines(engagement.id),
    loadArchitecture(engagement.id),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={[engagement.title, "Baselines"].join(" · ")}
        title="Baselines"
        description="A baseline pins exact published versions, the relationships among them and the domain assessments at the moment it is frozen. It can be sent for approval and compared."
      />
      <ArchitectureNav slug={slug} current="baselines" />

      {canEdit ? (
        <ActionForm
          fields={[
            { name: "label", label: "Label", wide: true },
            { name: "description", label: "Description", type: "textarea" },
          ]}
          action={createBaseline.bind(null, engagement.id)}
          submitLabel="Create baseline"
          trigger="New baseline"
        />
      ) : null}

      <Panel>
        {baselines.length === 0 ? (
          <EmptyState title="No baselines yet" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Baseline</Th>
                <Th>Status</Th>
                <Th>Versions</Th>
                <Th>Frozen</Th>
                <Th>Approval</Th>
              </tr>
            </thead>
            <tbody>
              {baselines.map((b) => {
                const approval = architecture.approvals.find((a) => a.baseline_id === b.id);
                return (
                  <tr key={b.id}>
                    <Td>
                      <Link
                        href={`/internal/engagements/${slug}/baselines/${b.id}`}
                        className="text-ink hover:underline"
                      >
                        {b.label}
                      </Link>
                      {b.description ? (
                        <p className="text-xs text-ink-muted">{b.description}</p>
                      ) : null}
                    </Td>
                    <Td>
                      <StatusTag tone={BASELINE_STATUS[b.status].tone}>
                        {BASELINE_STATUS[b.status].label}
                      </StatusTag>
                    </Td>
                    <Td className="tabular-nums">{b.architecture_baseline_items.length}</Td>
                    <Td className="text-xs text-ink-muted">
                      {b.frozen_at ? formatDateTime(b.frozen_at) : "—"}
                    </Td>
                    <Td>
                      {b.status === "frozen" ? (
                        <ApprovalTag
                          state={approvalState(
                            approval ? (approval.response ?? "awaiting_response") : null,
                          )}
                        />
                      ) : null}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  );
}

import Link from "next/link";
import { recordExternalApproval, requestApproval } from "@/domain/architecture/actions";
import {
  APPROVAL_METHODS,
  APPROVAL_METHOD_LABELS,
  approvalState,
} from "@/domain/architecture/catalog";
import type { ApprovalRow, LoadedElement } from "@/domain/architecture/queries";
import { formatDate, formatDateTime } from "@/lib/format";
import { ActionForm, type FieldSpec } from "@/components/ui/action-form";
import { EmptyState, Panel } from "@/components/ui/panel";
import { Table, Td, Th } from "@/components/ui/table";
import { ApprovalTag, InternalMark } from "./badges";

/** "Published v3 · v2 approved · v3 awaiting response" (proposal §5). */
export function publicationLine(element: LoadedElement): string | null {
  const latest = element.latestVersion;
  if (!latest) return null;
  const parts = [`Published v${latest.version_no}`];
  if (
    element.latestApprovedVersionNo !== null &&
    element.latestApprovedVersionNo !== latest.version_no
  ) {
    parts.push(`v${element.latestApprovedVersionNo} approved`);
  }
  const state = element.latestApprovalState;
  if (state === "approved") parts.push(`v${latest.version_no} approved`);
  if (state === "awaiting_response") parts.push(`v${latest.version_no} awaiting response`);
  if (state === "changes_requested") parts.push(`v${latest.version_no} changes requested`);
  return parts.join(" · ");
}

export const externalApprovalFields: FieldSpec[] = [
  {
    name: "response",
    label: "Response",
    type: "select",
    options: [
      { value: "approved", label: "Approved" },
      { value: "changes_requested", label: "Changes requested" },
    ],
  },
  {
    name: "method",
    label: "Method",
    type: "select",
    options: APPROVAL_METHODS.map((m) => ({ value: m, label: APPROVAL_METHOD_LABELS[m] })),
  },
  { name: "approverName", label: "Approver" },
  { name: "approverTitle", label: "Approver's title" },
  { name: "approvedOn", label: "Date", type: "date" },
  {
    name: "evidence",
    label: "Evidence",
    hint: "Where the approval is recorded, such as a signed document or email reference.",
  },
  { name: "comment", label: "Comment", type: "textarea" },
];

export function ApprovalDetail({
  approval,
  nameOf,
}: {
  approval: ApprovalRow | undefined;
  nameOf: (id: string | null) => string;
}) {
  if (!approval) return <span className="text-xs text-ink-subtle">Not requested</span>;
  const state = approvalState(approval.response ?? "awaiting_response");
  return (
    <div className="space-y-1">
      <ApprovalTag state={state} />
      {approval.response ? (
        <p className="text-xs text-ink-muted">
          {approval.approval_source === "client_portal"
            ? `In the portal by ${nameOf(approval.responded_by)}, ${formatDateTime(approval.responded_at!)}`
            : `Outside the portal: ${approval.external_approver_name}${approval.external_approver_title ? `, ${approval.external_approver_title}` : ""}, ${formatDate(approval.external_approved_on)} (${APPROVAL_METHOD_LABELS[approval.external_approval_method!]}; ${approval.external_evidence}). Recorded by ${nameOf(approval.recorded_by)}.`}
        </p>
      ) : (
        <p className="text-xs text-ink-muted">
          Requested {formatDateTime(approval.requested_at)} by {nameOf(approval.requested_by)}
        </p>
      )}
      {approval.comment ? <p className="text-xs text-ink">“{approval.comment}”</p> : null}
    </div>
  );
}

/**
 * Published versions (immutable) and the approval of each. Approval never
 * changes the lifecycle or what the client can see.
 */
export function VersionsPanel({
  slug,
  element,
  approvals,
  canPublish,
  nameOf,
  today,
}: {
  slug: string;
  element: LoadedElement;
  approvals: ApprovalRow[];
  canPublish: boolean;
  nameOf: (id: string | null) => string;
  today: string;
}) {
  const latest = element.latestVersion;
  const latestApproval = latest ? approvals.find((a) => a.element_version_id === latest.id) : null;
  const canRequest =
    canPublish &&
    latest !== null &&
    !latestApproval &&
    latest.client_visible_at_publication &&
    element.lifecycle !== "retired" &&
    element.lifecycle !== "superseded";

  return (
    <Panel
      title="Versions and approvals"
      description={
        publicationLine(element) ??
        "Not yet published. Clients see nothing until a version is published."
      }
    >
      <div className="space-y-4">
        {element.versions.length === 0 ? (
          <EmptyState title="No published versions" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Version</Th>
                <Th>Published</Th>
                <Th>Change</Th>
                <Th>Approval</Th>
              </tr>
            </thead>
            <tbody>
              {element.versions.map((v) => (
                <tr key={v.id}>
                  <Td className="whitespace-nowrap">
                    <Link
                      href={`/internal/engagements/${slug}/architecture/elements/${element.id}?version=${v.id}`}
                      className="hover:underline"
                    >
                      v{v.version_no}
                    </Link>
                    {v.client_visible_at_publication ? null : (
                      <span className="ml-2">
                        <InternalMark />
                      </span>
                    )}
                  </Td>
                  <Td className="text-xs whitespace-nowrap text-ink-muted">
                    {formatDateTime(v.published_at)}
                    <br />
                    {nameOf(v.published_by)}
                  </Td>
                  <Td className="text-ink-muted">{v.change_summary || "—"}</Td>
                  <Td>
                    <ApprovalDetail
                      approval={approvals.find((a) => a.element_version_id === v.id)}
                      nameOf={nameOf}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {canRequest ? (
          <div className="flex flex-wrap items-start gap-2">
            <ActionForm
              fields={[{ name: "note", label: "Note to the client", type: "textarea" }]}
              action={requestApproval.bind(null, { versionId: latest!.id })}
              submitLabel={`Request approval of v${latest!.version_no}`}
              trigger={`Request approval of v${latest!.version_no}`}
            />
            <ActionForm
              fields={externalApprovalFields}
              defaultValues={{ response: "approved", method: "meeting", approvedOn: today }}
              action={recordExternalApproval.bind(null, { versionId: latest!.id })}
              submitLabel="Record external response"
              trigger="Record approval given outside the portal"
              confirm="Record this response? It is final once recorded."
            />
          </div>
        ) : null}
        {canPublish && latestApproval && latestApproval.response === null ? (
          <ActionForm
            fields={externalApprovalFields}
            defaultValues={{ response: "approved", method: "meeting", approvedOn: today }}
            action={recordExternalApproval.bind(null, { versionId: latest!.id })}
            submitLabel="Record external response"
            trigger="Record approval given outside the portal"
            confirm="Record this response? It is final once recorded."
          />
        ) : null}
      </div>
    </Panel>
  );
}

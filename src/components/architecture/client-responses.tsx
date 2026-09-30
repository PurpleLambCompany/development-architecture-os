import { decideDecision, respondToApproval } from "@/domain/architecture/actions";
import { ActionForm } from "@/components/ui/action-form";

/** Approve or request changes on one exact published version or frozen baseline. */
export function ApprovalResponseForm({ approvalId, label }: { approvalId: string; label: string }) {
  return (
    <ActionForm
      fields={[
        {
          name: "response",
          label: "Your response",
          type: "select",
          options: [
            { value: "approved", label: "Approve" },
            { value: "changes_requested", label: "Request changes" },
          ],
        },
        {
          name: "comment",
          label: "Comment",
          type: "textarea",
          hint: "Required when requesting changes.",
        },
      ]}
      defaultValues={{ response: "approved" }}
      action={respondToApproval.bind(null, approvalId)}
      submitLabel="Send response"
      trigger={label}
      confirm="Send this response? It is recorded with your name and the exact version, and is final."
    />
  );
}

/** Choose an option on a published decision. */
export function DecisionForm({
  decisionId,
  options,
  recommendedOptionId,
}: {
  decisionId: string;
  options: { id: string; title: string }[];
  recommendedOptionId: string | null;
}) {
  return (
    <ActionForm
      fields={[
        {
          name: "optionId",
          label: "Your decision",
          type: "select",
          options: options.map((o) => ({
            value: o.id,
            label: o.id === recommendedOptionId ? `${o.title} (TPLCo recommendation)` : o.title,
          })),
        },
        { name: "note", label: "Note", type: "textarea" },
      ]}
      defaultValues={{ optionId: recommendedOptionId ?? options[0]?.id ?? "" }}
      action={decideDecision.bind(null, decisionId)}
      submitLabel="Record decision"
      trigger="Make this decision"
      confirm="Record this decision? It is final; changing course later means a new decision."
    />
  );
}

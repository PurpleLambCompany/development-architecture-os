import Link from "next/link";
import type { LoadedArchitecture, LoadedElement } from "@/domain/architecture/queries";
import { handleContribution, sendClientAction } from "@/domain/intelligence/actions";
import type { LoadedClientAction, LoadedContribution } from "@/domain/intelligence/queries";
import { ElementLink } from "@/components/architecture/badges";
import { ActionForm } from "@/components/ui/action-form";
import { EmptyState, Panel } from "@/components/ui/panel";
import { ContributionCard } from "./contribution-card";
import { handleContributionFields, sendActionFields } from "./fields";
import { RequestCard, subjectOptions } from "./request-card";

/** Client requests about this element and client input on it (internal view). */
export function ElementRequestsPanel({
  slug,
  engagementId,
  element,
  architecture,
  actions,
  contributions,
  statements,
  addressees,
  canEdit,
  canManageRequests,
  nameOf,
  today,
}: {
  slug: string;
  engagementId: string;
  element: LoadedElement;
  architecture: LoadedArchitecture;
  actions: LoadedClientAction[];
  contributions: LoadedContribution[];
  statements: { id: string; body: string }[];
  addressees: { value: string; label: string }[];
  canEdit: boolean;
  canManageRequests: boolean;
  nameOf: (id: string | null) => string;
  today: string;
}) {
  const askable =
    element.lifecycle === "published" && element.client_visibility === "client";
  const requestsHref = `/internal/engagements/${slug}/intelligence/requests`;
  if (!askable && actions.length === 0 && contributions.length === 0) return null;
  return (
    <Panel
      title="Client requests and input"
      description="Requests naming this element and input client members added on it. Handled and closed items are kept."
      actions={
        <Link href={requestsHref} className="text-sm text-ink-muted hover:underline">
          All requests
        </Link>
      }
    >
      <div className="space-y-4">
        {canManageRequests && askable && addressees.length > 0 ? (
          <ActionForm
            trigger="Ask the client about this"
            fields={sendActionFields(addressees, subjectOptions(architecture.elements))}
            defaultValues={{
              kind: "question",
              addresseeMemberId: addressees[0]!.value,
              subjectIds: [element.id],
            }}
            action={sendClientAction.bind(null, engagementId)}
            submitLabel="Send request"
          />
        ) : null}
        {actions.length === 0 && contributions.length === 0 ? (
          <EmptyState title="Nothing asked or added yet" />
        ) : null}
        {actions.map((action) => (
          <RequestCard
            key={action.id}
            action={action}
            audience="internal"
            today={today}
            name={nameOf}
            subject={(id) => {
              const e = architecture.byId.get(id);
              return e ? <ElementLink slug={slug} element={e} /> : null;
            }}
            controls={
              action.status === "open" || action.status === "responded" ? (
                <Link
                  href={`${requestsHref}#${action.reference_code}`}
                  className="text-sm text-accent hover:underline"
                >
                  Handle in client requests
                </Link>
              ) : null
            }
          />
        ))}
        {contributions.map((c) => (
          <ContributionCard
            key={c.id}
            contribution={c}
            name={nameOf}
            controls={
              canEdit && c.status === "received" ? (
                <ActionForm
                  trigger="Handle"
                  fields={handleContributionFields(
                    statements.map((s) => ({ value: s.id, label: s.body.slice(0, 100) })),
                  )}
                  defaultValues={{ status: "incorporated", recordAsEvidence: "no" }}
                  action={handleContribution.bind(null, c.id)}
                  submitLabel="Save"
                />
              ) : null
            }
          />
        ))}
      </div>
    </Panel>
  );
}

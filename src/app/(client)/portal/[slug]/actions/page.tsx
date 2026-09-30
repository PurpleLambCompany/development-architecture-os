import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientArchitectureContext, memberNames } from "@/domain/architecture/context";
import {
  getClientArchitecture,
  getClientDecisions,
  getClientPendingApprovals,
} from "@/domain/architecture/queries";
import { reassignClientAction, respondToClientAction } from "@/domain/intelligence/actions";
import { getClientActions } from "@/domain/intelligence/queries";
import { businessToday } from "@/domain/intelligence/views";
import { ReferenceCode } from "@/components/architecture/badges";
import { reassignFields } from "@/components/intelligence/fields";
import { RequestCard } from "@/components/intelligence/request-card";
import { UploadForm } from "@/components/intelligence/upload-form";
import { EngagementNav } from "@/components/portal/engagement-nav";
import { ActionForm } from "@/components/ui/action-form";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";

/**
 * What is required from the client: requests addressed to the viewer, with
 * approvals and decisions awaiting a response. Members who assign requests
 * (by default the Executive Sponsor and Client Project Lead) see every
 * request on the engagement and can reassign open ones. The database
 * returns only what the viewer may see.
 */
export default async function ClientActionsPage({ params }: PageProps<"/portal/[slug]/actions">) {
  const { slug } = await params;
  const { viewer, engagement, capabilities, canRespond } = await getClientArchitectureContext(slug);
  const canAssign = capabilities.has("assign_client_actions");
  const canAnswer = capabilities.has("respond_to_client_actions") || canRespond;
  if (!canAnswer && !canAssign && !capabilities.has("view_architecture")) notFound();
  const [actions, published, approvals, decisions] = await Promise.all([
    getClientActions(engagement.id),
    capabilities.has("view_architecture") ? getClientArchitecture(engagement.id) : [],
    canRespond ? getClientPendingApprovals(engagement.id) : [],
    canRespond ? getClientDecisions(engagement.id) : [],
  ]);
  const today = businessToday();
  const name = memberNames(engagement);
  const byId = new Map(published.map((r) => [r.element_id, r]));
  const subject = (id: string) => {
    const row = byId.get(id);
    return row ? (
      <Link
        href={`/portal/${slug}/architecture/${id}`}
        className="group inline-flex items-baseline gap-2"
      >
        <ReferenceCode code={row.reference_code} />
        <span className="text-ink group-hover:underline">{row.title}</span>
      </Link>
    ) : null;
  };
  const clientMembers = engagement.engagement_members.filter(
    (m) => m.side === "client" && m.status === "active",
  );
  const mine = actions.filter((a) => a.addressed_to_user_id === viewer.id);
  const others = actions.filter((a) => a.addressed_to_user_id !== viewer.id);
  const waiting = mine.filter((a) => a.status === "open");
  const openDecisions = decisions.filter(
    (d) => d.decision_status === "open" || d.decision_status === "recommended",
  );
  const card = (action: (typeof actions)[number]) => (
    <RequestCard
      key={action.id}
      action={action}
      audience="client"
      today={today}
      name={(id) => (id === viewer.id ? "you" : name(id))}
      subject={subject}
      controls={
        <>
          {action.status === "open" && action.addressed_to_user_id === viewer.id ? (
            <UploadForm
              engagementId={engagement.id}
              purpose="client_response"
              action={respondToClientAction.bind(null, action.id)}
              bodyLabel="Your response"
              submitLabel="Send response"
              trigger="Respond"
            />
          ) : null}
          {action.status === "open" && canAssign ? (
            <ActionForm
              trigger="Reassign"
              fields={reassignFields(
                clientMembers
                  .filter((m) => m.id !== action.addressed_to_member_id)
                  .map((m) => ({ value: m.id, label: name(m.user_id) })),
              )}
              action={reassignClientAction.bind(null, action.id)}
              submitLabel="Reassign"
            />
          ) : null}
        </>
      }
    />
  );

  return (
    <div className="space-y-8">
      <EngagementNav slug={slug} engagementId={engagement.id} current="actions" />
      <PageHeader
        eyebrow={engagement.organizations?.name ?? "Actions"}
        title="What is required from us"
        description="Requests from The Purple Lamb Company addressed to you, and approvals and decisions awaiting your response."
      />

      <Panel
        title="Awaiting your response"
        description={
          waiting.length === 0
            ? undefined
            : "Respond in writing, with a link or files if they help. TPLCo reviews each response and may ask for more."
        }
      >
        {waiting.length === 0 ? (
          <EmptyState title="No requests awaiting you" />
        ) : (
          <div className="space-y-4">{waiting.map(card)}</div>
        )}
      </Panel>

      {canRespond ? (
        <Panel
          title="Approvals and decisions"
          actions={
            approvals.length + openDecisions.length > 0 ? (
              <ButtonLink href={`/portal/${slug}/decisions`} variant="secondary" size="sm">
                Open decisions
              </ButtonLink>
            ) : null
          }
        >
          {approvals.length + openDecisions.length === 0 ? (
            <EmptyState title="Nothing awaiting approval or decision" />
          ) : (
            <p className="text-sm text-ink">
              {approvals.length} approval request{approvals.length === 1 ? "" : "s"} and{" "}
              {openDecisions.length} decision{openDecisions.length === 1 ? "" : "s"} await your
              response.
            </p>
          )}
        </Panel>
      ) : null}

      {canAssign ? (
        <Panel
          title="Across the engagement"
          description="Requests addressed to others on your team. Reassign an open request when someone else is better placed to answer."
        >
          {others.length === 0 ? (
            <EmptyState title="No other requests" />
          ) : (
            <div className="space-y-4">{others.map(card)}</div>
          )}
        </Panel>
      ) : null}

      <Panel title="Your earlier requests">
        {mine.filter((a) => a.status !== "open").length === 0 ? (
          <EmptyState title="None yet" />
        ) : (
          <div className="space-y-4">{mine.filter((a) => a.status !== "open").map(card)}</div>
        )}
      </Panel>
    </div>
  );
}

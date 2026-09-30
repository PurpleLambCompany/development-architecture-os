import { getInternalArchitectureContext, memberNames } from "@/domain/architecture/context";
import { loadArchitecture } from "@/domain/architecture/queries";
import {
  closeClientAction,
  reassignClientAction,
  recordResponseAsEvidence,
  returnClientAction,
  sendClientAction,
  withdrawClientAction,
} from "@/domain/intelligence/actions";
import {
  getClientActions,
  getContributions,
  getSignals,
  getStatementOptions,
} from "@/domain/intelligence/queries";
import { businessToday, clientMembersWith } from "@/domain/intelligence/views";
import { ArchitectureNav } from "@/components/architecture/architecture-nav";
import { ElementLink } from "@/components/architecture/badges";
import {
  reassignFields,
  recordAsEvidenceFields,
  requiredNoteFields,
  sendActionFields,
} from "@/components/intelligence/fields";
import { IntelligenceNav } from "@/components/intelligence/intelligence-nav";
import { RequestCard, subjectOptions } from "@/components/intelligence/request-card";
import { ActionForm } from "@/components/ui/action-form";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";

export default async function ClientRequestsPage({
  params,
}: PageProps<"/internal/engagements/[slug]/intelligence/requests">) {
  const { slug } = await params;
  const { engagement, canEdit, canManageRequests } = await getInternalArchitectureContext(slug);
  const [actions, contributions, signals, architecture, statements, respondents] =
    await Promise.all([
      getClientActions(engagement.id),
      getContributions(engagement.id),
      getSignals(engagement.id),
      loadArchitecture(engagement.id),
      getStatementOptions(engagement.id),
      clientMembersWith(engagement, ["view_architecture", "respond_to_client_actions"]),
    ]);
  const today = businessToday();
  const name = memberNames(engagement);
  const addressees = respondents.map((m) => ({ value: m.id, label: name(m.user_id) }));
  const subject = (id: string) => {
    const element = architecture.byId.get(id);
    return element ? <ElementLink slug={slug} element={element} /> : null;
  };
  const statementOptions = (action: (typeof actions)[number]) =>
    statements
      .filter((s) => action.subjects.includes(s.element_id))
      .map((s) => ({
        value: s.id,
        label: `${architecture.byId.get(s.element_id)?.reference_code ?? ""} ${s.body.slice(0, 90)}`,
      }));

  const groups = [
    {
      title: "Responded, awaiting TPLCo",
      description: "Close when the response is sufficient, or return it asking for more.",
      items: actions.filter((a) => a.status === "responded"),
    },
    {
      title: "Awaiting the client",
      description: "Sent and not yet answered, overdue first.",
      items: actions
        .filter((a) => a.status === "open")
        .sort((a, b) => (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999")),
    },
    {
      title: "Closed and withdrawn",
      description: "The record of what was asked and answered.",
      items: actions.filter((a) => a.status === "closed" || a.status === "withdrawn"),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={[engagement.title, "Project Intelligence"].join(" · ")}
        title="Client requests"
        description="Questions, information requests, confirmations and reviews sent to named client members, with their responses. Client words become evidence only when TPLCo records them as evidence."
      />
      <ArchitectureNav slug={slug} current="intelligence" />
      <IntelligenceNav
        slug={slug}
        current="requests"
        counts={{
          requests: actions.filter((a) => a.status === "open" || a.status === "responded").length,
          input: contributions.filter((c) => c.status === "received").length,
          signals: signals.filter((s) => !s.dismissed).length,
        }}
      />

      {canManageRequests ? (
        <Panel
          title="Send a request"
          description="Executive attention is raised by escalating a record, not sent here."
        >
          {addressees.length === 0 ? (
            <EmptyState title="No client member can receive requests">
              Client members need to view the architecture and respond to requests.
            </EmptyState>
          ) : (
            <ActionForm
              trigger="New request"
              fields={sendActionFields(addressees, subjectOptions(architecture.elements))}
              defaultValues={{ kind: "question", addresseeMemberId: addressees[0]!.value }}
              action={sendClientAction.bind(null, engagement.id)}
              submitLabel="Send request"
            />
          )}
        </Panel>
      ) : null}

      {groups.map((group) => (
        <Panel key={group.title} title={group.title} description={group.description}>
          {group.items.length === 0 ? (
            <EmptyState title="None" />
          ) : (
            <div className="space-y-4">
              {group.items.map((action) => (
                <RequestCard
                  key={action.id}
                  action={action}
                  audience="internal"
                  today={today}
                  name={name}
                  subject={subject}
                  controls={
                    canManageRequests ? (
                      <>
                        {action.status === "responded" ? (
                          <>
                            <ActionForm
                              trigger="Close"
                              fields={requiredNoteFields("Note", "Optional.")}
                              action={closeClientAction.bind(null, action.id)}
                              submitLabel="Close request"
                            />
                            <ActionForm
                              trigger="Return for more"
                              fields={requiredNoteFields(
                                "What is still needed",
                                "The client sees this note.",
                              )}
                              action={returnClientAction.bind(null, action.id)}
                              submitLabel="Return to the client"
                            />
                          </>
                        ) : null}
                        {action.status === "open" && addressees.length > 1 ? (
                          <ActionForm
                            trigger="Reassign"
                            fields={reassignFields(
                              addressees.filter((a) => a.value !== action.addressed_to_member_id),
                            )}
                            action={reassignClientAction.bind(null, action.id)}
                            submitLabel="Reassign"
                          />
                        ) : null}
                        {action.status === "open" || action.status === "responded" ? (
                          <ActionForm
                            trigger="Withdraw"
                            variant="danger"
                            fields={requiredNoteFields("Why it is withdrawn")}
                            action={withdrawClientAction.bind(null, action.id)}
                            submitLabel="Withdraw request"
                          />
                        ) : null}
                      </>
                    ) : null
                  }
                  responseControls={(response) =>
                    canEdit && !response.recorded_as_evidence_at ? (
                      <ActionForm
                        trigger="Record as evidence"
                        fields={recordAsEvidenceFields(statementOptions(action))}
                        defaultValues={{ stance: "supports" }}
                        action={recordResponseAsEvidence.bind(null, response.id)}
                        submitLabel="Record as evidence"
                      />
                    ) : null
                  }
                />
              ))}
            </div>
          )}
        </Panel>
      ))}
    </div>
  );
}

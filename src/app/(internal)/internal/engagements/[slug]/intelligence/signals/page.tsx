import Link from "next/link";
import { getInternalArchitectureContext } from "@/domain/architecture/context";
import { dismissSignal } from "@/domain/intelligence/actions";
import { SIGNAL_RULES, signalLabel } from "@/domain/intelligence/catalog";
import { getClientActions, getContributions, getSignals } from "@/domain/intelligence/queries";
import { formatDate } from "@/lib/format";
import { ArchitectureNav } from "@/components/architecture/architecture-nav";
import { ReferenceCode } from "@/components/architecture/badges";
import { dismissFields } from "@/components/intelligence/fields";
import { IntelligenceNav } from "@/components/intelligence/intelligence-nav";
import { ActionForm } from "@/components/ui/action-form";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status-tag";
import { Table, Td, Th } from "@/components/ui/table";

export default async function SignalsPage({
  params,
  searchParams,
}: PageProps<"/internal/engagements/[slug]/intelligence/signals">) {
  const { slug } = await params;
  const showDismissed = (await searchParams).dismissed === "yes";
  const { engagement, canEdit } = await getInternalArchitectureContext(slug);
  const [signals, actions, contributions] = await Promise.all([
    getSignals(engagement.id, true),
    getClientActions(engagement.id),
    getContributions(engagement.id),
  ]);
  const base = `/internal/engagements/${slug}/intelligence`;
  const open = signals.filter((s) => !s.dismissed);
  const shown = showDismissed ? signals : open;
  const rank = (rule: string) => {
    const i = (SIGNAL_RULES as readonly string[]).indexOf(rule);
    return i < 0 ? SIGNAL_RULES.length : i;
  };
  const ordered = [...shown].sort(
    (a, b) => rank(a.rule_key) - rank(b.rule_key) || a.reference_code.localeCompare(b.reference_code),
  );
  const href = (s: (typeof signals)[number]) =>
    s.client_action_id
      ? `${base}/requests#${s.reference_code}`
      : `/internal/engagements/${slug}/architecture/elements/${s.element_id}`;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={[engagement.title, "Project Intelligence"].join(" · ")}
        title="Signals"
        description="Deterministic rules over the register that point at something needing judgment. A signal is a prompt to look, never a conclusion; dismiss it with a reason when it needs no action. It returns if its facts change."
      />
      <ArchitectureNav slug={slug} current="intelligence" />
      <IntelligenceNav
        slug={slug}
        current="signals"
        counts={{
          requests: actions.filter((a) => a.status === "open" || a.status === "responded").length,
          input: contributions.filter((c) => c.status === "received").length,
          signals: open.length,
        }}
      />
      <Panel
        title={showDismissed ? "All signals" : "Open signals"}
        description={`${ordered.length} shown.`}
        actions={
          <Link
            href={showDismissed ? `${base}/signals` : `${base}/signals?dismissed=yes`}
            className="text-sm text-ink-muted hover:underline"
          >
            {showDismissed ? "Hide dismissed" : "Include dismissed"}
          </Link>
        }
      >
        {ordered.length === 0 ? (
          <EmptyState title="No open signals">Nothing in the register trips a rule today.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Signal</Th>
                <Th>Subject</Th>
                <Th className="w-48">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((s) => {
                const label = signalLabel(s.rule_key);
                return (
                  <tr key={`${s.rule_key}:${s.element_id ?? s.client_action_id}`}>
                    <Td>
                      <StatusTag tone={s.dismissed ? "neutral" : label.attention}>
                        {label.label}
                      </StatusTag>
                    </Td>
                    <Td>
                      <Link href={href(s)} className="group inline-flex items-baseline gap-2">
                        <ReferenceCode code={s.reference_code} />
                        <span className="text-ink group-hover:underline">{s.title}</span>
                      </Link>
                      {s.dismissed ? (
                        <p className="mt-1 text-xs text-ink-muted">
                          Dismissed {formatDate(s.dismissed_at)}: {s.dismissal_reason}
                        </p>
                      ) : null}
                    </Td>
                    <Td>
                      {canEdit && !s.dismissed ? (
                        <ActionForm
                          trigger="Dismiss"
                          fields={dismissFields}
                          action={dismissSignal.bind(null, engagement.id, {
                            ruleKey: s.rule_key,
                            elementId: s.client_action_id ? null : s.element_id,
                            clientActionId: s.client_action_id,
                            fingerprint: s.fingerprint,
                          })}
                          submitLabel="Dismiss signal"
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

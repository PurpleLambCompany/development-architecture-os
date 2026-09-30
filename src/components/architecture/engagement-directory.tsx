import Link from "next/link";
import { DOMAINS, DOMAIN_SHORT_LABELS, MATURITY_LABELS } from "@/domain/architecture/catalog";
import { getDomainStates } from "@/domain/architecture/queries";
import { listEngagements } from "@/domain/engagements/queries";
import { EmptyState, Panel } from "@/components/ui/panel";
import { Table, Td, Th } from "@/components/ui/table";

/** Engagements the viewer can read, with each domain's latest assessed state. */
export async function EngagementDirectory({
  section,
}: {
  section: "architecture" | "intelligence";
}) {
  const engagements = (await listEngagements()).filter((e) => e.status !== "archived");
  const states = await Promise.all(engagements.map((e) => getDomainStates(e.id)));

  return (
    <Panel>
      {engagements.length === 0 ? (
        <EmptyState title="No engagements to show" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Engagement</Th>
              {DOMAINS.map((d) => (
                <Th key={d}>{DOMAIN_SHORT_LABELS[d]}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {engagements.map((e, index) => (
              <tr key={e.id}>
                <Td>
                  <Link
                    href={`/internal/engagements/${e.slug}/${section}`}
                    className="text-ink hover:underline"
                  >
                    {e.title}
                  </Link>
                  <p className="text-xs text-ink-subtle">{e.organizations?.name}</p>
                </Td>
                {DOMAINS.map((d) => {
                  const state = states[index]!.find((s) => s.domain === d);
                  return (
                    <Td key={d} className="whitespace-nowrap text-ink-muted">
                      {state ? MATURITY_LABELS[state.maturity] : "—"}
                    </Td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Panel>
  );
}

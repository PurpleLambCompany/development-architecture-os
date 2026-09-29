import Link from "next/link";
import { redirect } from "next/navigation";
import { requireClient } from "@/lib/auth/viewer";
import { formatDateRange } from "@/lib/format";
import { ENGAGEMENT_TYPE_LABELS } from "@/domain/engagements/catalog";
import { listEngagements } from "@/domain/engagements/queries";
import { EngagementStatusTag } from "@/components/engagements/engagement-status";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";

export const metadata = { title: "Your engagements" };

export default async function PortalHome() {
  await requireClient();
  const engagements = (await listEngagements()).filter((e) => e.status !== "archived");

  if (engagements.length === 1) redirect(`/portal/${engagements[0]!.slug}`);

  return (
    <div className="space-y-8">
      <PageHeader title="Your engagements" />
      <Panel>
        {engagements.length === 0 ? (
          <EmptyState title="No engagements yet">
            You will see an engagement here as soon as the TPLCo team adds you to it.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-rule/70">
            {engagements.map((engagement) => (
              <li key={engagement.id} className="flex items-center justify-between gap-4 py-4">
                <div>
                  <Link
                    href={`/portal/${engagement.slug}`}
                    className="font-serif text-lg text-ink hover:underline"
                  >
                    {engagement.title}
                  </Link>
                  <p className="text-sm text-ink-muted">
                    {ENGAGEMENT_TYPE_LABELS[engagement.engagement_type]}
                    {engagement.start_date
                      ? ` · ${formatDateRange(engagement.start_date, engagement.target_end_date)}`
                      : ""}
                  </p>
                </div>
                <EngagementStatusTag status={engagement.status} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

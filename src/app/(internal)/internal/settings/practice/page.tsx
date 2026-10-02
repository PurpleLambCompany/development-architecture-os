import Link from "next/link";
import { clearPracticeOverride, setPracticeOverride } from "@/domain/methodology/actions";
import {
  PRACTICE_CAPABILITIES,
  PRACTICE_CAPABILITY_LABELS,
  type PracticeCapability,
} from "@/domain/methodology/catalog";
import {
  getMyPracticeCapabilities,
  getPracticeCapabilityMatrix,
} from "@/domain/methodology/queries";
import { ROLE_LABELS } from "@/domain/roles/roles";
import { requireInternal } from "@/lib/auth/viewer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status-tag";
import { Table, Td, Th } from "@/components/ui/table";

export const metadata = { title: "Practice capabilities" };

/**
 * Practice capabilities (D10, D11, ADR-0044; V1-A D1, ADR-0074): who
 * administers the practice, and who may author and publish TPLCo
 * methodology. Organization-wide, separate from engagement capabilities.
 * Role defaults plus recorded overrides. Practice administrators change
 * administer_practice; publish_methodology holders change the Method
 * capabilities. Never for oneself, and at least one holder of
 * administer_practice and of publish_methodology always remains. The
 * database enforces all of it.
 */
export default async function PracticeCapabilitiesPage() {
  const viewer = await requireInternal();
  const [matrix, mine] = await Promise.all([
    getPracticeCapabilityMatrix(),
    getMyPracticeCapabilities(),
  ]);
  const supabase = await createSupabaseServerClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email")
    .in("id", [...new Set(matrix.map((m) => m.user_id))]);
  const nameOf = (id: string) => {
    const p = profiles?.find((x) => x.id === id);
    return p ? [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email : "TPLCo member";
  };
  const members = [...new Map(matrix.map((m) => [m.organization_member_id, m])).values()];
  const cell = (memberId: string, capability: PracticeCapability) =>
    matrix.find((m) => m.organization_member_id === memberId && m.capability === capability)!;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Practice capabilities"
        description="Who administers the practice, and who may author and publish TPLCo methodology. These are organization-wide and separate from engagement capabilities. Clients never hold them."
      />
      <p className="text-sm text-ink-muted">
        <Link href="/internal/settings" className="hover:underline">
          Your profile
        </Link>{" "}
        · Practice capabilities
      </p>
      <Panel
        title="TPLCo members"
        description="Overrides need a reason. Practice administrators change who administers the practice; members who can publish methodology change the methodology capabilities. Nobody changes their own, and someone always keeps each of Administer the practice and Publish methodology."
      >
        <Table>
          <thead>
            <tr>
              <Th>Member</Th>
              <Th>Role</Th>
              {PRACTICE_CAPABILITIES.map((c) => (
                <Th key={c}>{PRACTICE_CAPABILITY_LABELS[c]}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.organization_member_id}>
                <Td>
                  {nameOf(m.user_id)}
                  {m.status !== "active" ? (
                    <span className="text-ink-subtle"> · {m.status}</span>
                  ) : null}
                </Td>
                <Td className="text-ink-muted">{ROLE_LABELS[m.role]}</Td>
                {PRACTICE_CAPABILITIES.map((c) => {
                  const x = cell(m.organization_member_id, c);
                  const self = m.user_id === viewer.id;
                  // A Principal Architect always administers the practice (D4);
                  // the database refuses revoking it.
                  const fixed =
                    c === "administer_practice" && m.role === "principal_architect" && x.effective;
                  const canChange =
                    !fixed && (c === "administer_practice" ? mine.canAdminister : mine.canPublish);
                  return (
                    <Td key={c}>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusTag tone={x.effective ? "positive" : "neutral"}>
                            {x.effective ? "Yes" : "No"}
                          </StatusTag>
                          <span className="text-xs text-ink-subtle">
                            {x.override_granted === null
                              ? x.role_default
                                ? "role default"
                                : "not in role default"
                              : x.override_granted
                                ? "granted by override"
                                : "revoked by override"}
                          </span>
                        </div>
                        {x.override_reason ? (
                          <p className="text-xs text-ink-muted">{x.override_reason}</p>
                        ) : null}
                        {canChange && !self ? (
                          <div className="flex flex-wrap gap-2">
                            <ActionForm
                              trigger={x.effective ? "Revoke" : "Grant"}
                              variant={x.effective ? "danger" : "primary"}
                              submitLabel={x.effective ? "Revoke" : "Grant"}
                              action={setPracticeOverride.bind(null, m.organization_member_id)}
                              fields={[{ name: "reason", label: "Reason", type: "textarea" }]}
                              defaultValues={{}}
                              hidden={{ capability: c, granted: x.effective ? "no" : "yes" }}
                            />
                            {x.override_granted !== null ? (
                              <ActionButton
                                action={clearPracticeOverride.bind(
                                  null,
                                  m.organization_member_id,
                                  c,
                                )}
                                label="Return to role default"
                                variant="ghost"
                              />
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </Td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </div>
  );
}

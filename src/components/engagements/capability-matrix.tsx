"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setMemberCapability } from "@/domain/capabilities/actions";
import {
  CAPABILITY_LABELS,
  ENGAGEMENT_CAPABILITIES,
  type EngagementCapability,
} from "@/domain/capabilities/catalog";
import type { CapabilitySetting } from "@/domain/capabilities/schemas";
import { cn } from "@/lib/utils";
import { FormMessage } from "@/components/ui/field";
import { Table, Td, Th } from "@/components/ui/table";

export type CapabilityCell = {
  /** The role default. */
  byDefault: boolean;
  /** The override, if any. */
  setting: CapabilitySetting;
  effective: boolean;
  /** false when the capability cannot apply to this member's side. */
  applicable: boolean;
  canManage: boolean;
};

export type CapabilityRow = {
  memberId: string;
  name: string;
  roleLabel: string;
  cells: Record<EngagementCapability, CapabilityCell>;
};

const SETTING_LABELS: Record<CapabilitySetting, string> = {
  default: "Role default",
  grant: "Granted",
  revoke: "Revoked",
};

/**
 * Effective capabilities per team member. A cell shows whether the member
 * holds the capability; managers can override it for this engagement only.
 * The database re-checks every change.
 */
export function CapabilityMatrix({ rows }: { rows: CapabilityRow[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const change = (memberId: string, capability: EngagementCapability, setting: string) => {
    setError(null);
    startTransition(async () => {
      const result = await setMemberCapability({ memberId, capability, setting });
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <Table aria-busy={pending}>
        <thead>
          <tr>
            <Th>Member</Th>
            {ENGAGEMENT_CAPABILITIES.map((capability) => (
              <Th key={capability} className="min-w-28 normal-case">
                {CAPABILITY_LABELS[capability]}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.memberId}>
              <Td>
                <p className="font-medium">{row.name}</p>
                <p className="text-xs text-ink-subtle">{row.roleLabel}</p>
              </Td>
              {ENGAGEMENT_CAPABILITIES.map((capability) => {
                const cell = row.cells[capability];
                if (!cell.applicable) {
                  return (
                    <Td key={capability} className="text-ink-subtle">
                      <span aria-label="Not applicable">·</span>
                    </Td>
                  );
                }
                return (
                  <Td key={capability}>
                    <p className={cn("text-sm", cell.effective ? "text-ink" : "text-ink-subtle")}>
                      {cell.effective ? "Yes" : "No"}
                      {cell.setting !== "default" ? (
                        <span className="ml-1 text-xs text-accent">
                          ({SETTING_LABELS[cell.setting].toLowerCase()})
                        </span>
                      ) : null}
                    </p>
                    {cell.canManage ? (
                      <select
                        aria-label={`${CAPABILITY_LABELS[capability]} for ${row.name}`}
                        className="mt-1 rounded-sm border border-rule bg-surface px-1 py-0.5 text-xs text-ink-muted"
                        value={cell.setting}
                        disabled={pending}
                        onChange={(event) => change(row.memberId, capability, event.target.value)}
                      >
                        <option value="default">
                          Role default ({cell.byDefault ? "yes" : "no"})
                        </option>
                        <option value="grant">Grant</option>
                        <option value="revoke">Revoke</option>
                      </select>
                    ) : null}
                  </Td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </Table>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-result";
import {
  resendInvitation,
  revokeInvitation,
  updateOrganizationMember,
} from "@/domain/memberships/actions";
import { CAPABILITY_LABELS, ROLE_CAPABILITY_DEFAULTS } from "@/domain/capabilities/catalog";
import { ROLE_LABELS, type AppRole } from "@/domain/roles/roles";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";

/**
 * What changing a role means on every engagement the person is on: the
 * engagement role follows the practice role (D3), so their default
 * capabilities change; overrides are kept.
 */
function roleChangeSummary(name: string, from: AppRole, to: AppRole): string {
  const before = new Set(ROLE_CAPABILITY_DEFAULTS[from]);
  const after = new Set(ROLE_CAPABILITY_DEFAULTS[to]);
  const gains = [...after].filter((c) => !before.has(c)).map((c) => CAPABILITY_LABELS[c]);
  const loses = [...before].filter((c) => !after.has(c)).map((c) => CAPABILITY_LABELS[c]);
  return [
    `Change ${name} from ${ROLE_LABELS[from]} to ${ROLE_LABELS[to]}?`,
    "Their role on every engagement they are on follows.",
    gains.length ? `By default they gain: ${gains.join(", ")}.` : null,
    loses.length ? `By default they lose: ${loses.join(", ")}.` : null,
    "Capability overrides on each engagement are kept.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * The actions on one membership row: change role, suspend or restore, and
 * for a pending invitation, resend or revoke. The page passes only what
 * the viewer may do; the database enforces every rule regardless.
 */
export function MemberActions({
  memberId,
  name,
  role,
  status,
  roleOptions,
  canRestore,
}: {
  memberId: string;
  name: string;
  role: AppRole;
  status: string;
  /** Roles the viewer may give this person (D2). */
  roleOptions: readonly AppRole[];
  /** False when restoring would recreate authority the viewer cannot create. */
  canRestore: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nextRole, setNextRole] = useState<AppRole>(role);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const run = (confirmText: string | null, work: () => Promise<ActionResult>, done: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setMessage(null);
    startTransition(async () => {
      const result = await work();
      setMessage(
        result.ok ? { tone: "success", text: done } : { tone: "error", text: result.error },
      );
      router.refresh();
    });
  };

  const options = roleOptions.includes(role) ? roleOptions : [role, ...roleOptions];

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {status === "invited" ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                run(null, () => resendInvitation(memberId), `A new invitation was sent to ${name}.`)
              }
            >
              Resend invitation
            </Button>
            <Button
              type="button"
              size="sm"
              variant="danger"
              disabled={pending}
              onClick={() =>
                run(
                  `Revoke ${name}'s invitation? The link they were sent will stop working.`,
                  () => revokeInvitation(memberId),
                  `${name}'s invitation was revoked.`,
                )
              }
            >
              Revoke invitation
            </Button>
          </>
        ) : null}

        {status === "active" ? (
          <>
            {options.length > 1 ? (
              <>
                <Select
                  aria-label={`Role for ${name}`}
                  value={nextRole}
                  disabled={pending}
                  onChange={(event) => setNextRole(event.target.value as AppRole)}
                  className="w-auto"
                >
                  {options.map((option) => (
                    <option key={option} value={option} disabled={!roleOptions.includes(option)}>
                      {ROLE_LABELS[option]}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={pending || nextRole === role}
                  onClick={() =>
                    run(
                      roleChangeSummary(name, role, nextRole),
                      () => updateOrganizationMember(memberId, { role: nextRole, status }),
                      `${name} is now ${ROLE_LABELS[nextRole]}.`,
                    )
                  }
                >
                  Change role
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="danger"
              disabled={pending}
              onClick={() =>
                run(
                  `Suspend ${name}? They lose all access at once, on every engagement.`,
                  () => updateOrganizationMember(memberId, { role, status: "suspended" }),
                  `${name} was suspended.`,
                )
              }
            >
              Suspend
            </Button>
          </>
        ) : null}

        {status === "suspended" && canRestore ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              run(
                null,
                () => updateOrganizationMember(memberId, { role, status: "active" }),
                `${name} was restored.`,
              )
            }
          >
            Restore
          </Button>
        ) : null}
      </div>
      {message ? (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={message.tone === "error" ? "text-xs text-negative" : "text-xs text-ink-muted"}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}

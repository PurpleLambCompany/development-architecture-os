"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { assignEngagementMember, removeEngagementMember } from "@/domain/memberships/actions";
import { CLIENT_ROLES, ROLE_LABELS, type AppRole, type ClientRole } from "@/domain/roles/roles";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";

export type AssignableUser = {
  userId: string;
  orgRole: AppRole;
  side: "internal" | "client";
  name: string;
  email: string;
  status: string;
};

export function AddTeamMemberForm({
  engagementId,
  candidates,
}: {
  engagementId: string;
  candidates: AssignableUser[];
}) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<ClientRole | "">("");
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = candidates.find((candidate) => candidate.userId === userId);
  // An internal person's engagement role is their practice role (D3); only
  // a client person's role is chosen here.
  const internal = selected?.side === "internal";

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (!selected || (!internal && !role)) {
      setMessage({ tone: "error", text: "Choose a person and a role." });
      return;
    }
    startTransition(async () => {
      const result = await assignEngagementMember(
        engagementId,
        internal ? { userId } : { userId, role },
      );
      if (!result.ok) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      setMessage({ tone: "success", text: `${selected.name || selected.email} added.` });
      setUserId("");
      setRole("");
      router.refresh();
    });
  };

  if (candidates.length === 0) {
    return (
      <p className="text-sm text-ink-muted">Everyone eligible is already on this engagement.</p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <Field label="Person" htmlFor="member-user">
          <Select
            id="member-user"
            value={userId}
            onChange={(event) => {
              const next = candidates.find((c) => c.userId === event.target.value);
              setUserId(event.target.value);
              setRole(next?.side === "client" ? (next.orgRole as ClientRole) : "");
            }}
          >
            <option value="">Select…</option>
            <optgroup label="TPLCo">
              {candidates
                .filter((c) => c.side === "internal")
                .map((c) => (
                  <option key={c.userId} value={c.userId}>
                    {c.name || c.email} — {ROLE_LABELS[c.orgRole]}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Client">
              {candidates
                .filter((c) => c.side === "client")
                .map((c) => (
                  <option key={c.userId} value={c.userId}>
                    {c.name || c.email} — {ROLE_LABELS[c.orgRole]}
                  </option>
                ))}
            </optgroup>
          </Select>
        </Field>
        {internal ? (
          <Field
            label="Engagement role"
            htmlFor="member-practice-role"
            hint="Their practice role. Differences on this engagement are capability overrides."
          >
            <Input id="member-practice-role" value={ROLE_LABELS[selected.orgRole]} readOnly />
          </Field>
        ) : (
          <Field label="Engagement role" htmlFor="member-role">
            <Select
              id="member-role"
              value={role}
              disabled={!selected}
              onChange={(event) => setRole(event.target.value as ClientRole)}
            >
              <option value="">Select…</option>
              {CLIENT_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Button type="submit" variant="secondary" disabled={pending}>
          Add to team
        </Button>
      </div>
    </form>
  );
}

export function RemoveTeamMemberButton({ memberId, name }: { memberId: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`Remove ${name} from this engagement?`)) return;
        startTransition(async () => {
          const result = await removeEngagementMember(memberId);
          if (!result.ok) window.alert(result.error);
          router.refresh();
        });
      }}
    >
      Remove
    </Button>
  );
}

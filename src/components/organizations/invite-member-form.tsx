"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { applyServerErrors } from "@/lib/forms";
import { inviteOrganizationMember } from "@/domain/memberships/actions";
import { inviteMemberSchema } from "@/domain/memberships/schemas";
import { ROLE_LABELS, type AppRole } from "@/domain/roles/roles";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";

type Values = z.input<typeof inviteMemberSchema>;

export function InviteMemberForm({
  organizationId,
  roles,
}: {
  organizationId: string;
  roles: readonly AppRole[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<Values>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: "", firstName: "", lastName: "", role: roles[roles.length - 1] },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setMessage(null);
    startTransition(async () => {
      const result = await inviteOrganizationMember(organizationId, values);
      if (!result.ok) {
        setMessage({ tone: "error", text: result.error });
        applyServerErrors(form, result);
        return;
      }
      setMessage({
        tone: "success",
        text:
          result.data.outcome === "added"
            ? `${values.email} already has an account and was added to this organization.`
            : `Invitation sent to ${values.email}.`,
      });
      form.reset();
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="invite-first" error={errors.firstName?.message}>
          <Input
            id="invite-first"
            aria-invalid={!!errors.firstName}
            {...form.register("firstName")}
          />
        </Field>
        <Field label="Last name" htmlFor="invite-last" error={errors.lastName?.message}>
          <Input id="invite-last" aria-invalid={!!errors.lastName} {...form.register("lastName")} />
        </Field>
        <Field label="Email" htmlFor="invite-email" error={errors.email?.message}>
          <Input
            id="invite-email"
            type="email"
            aria-invalid={!!errors.email}
            {...form.register("email")}
          />
        </Field>
        <Field label="Role" htmlFor="invite-role" error={errors.role?.message}>
          <Select id="invite-role" {...form.register("role")}>
            {roles.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="secondary" disabled={pending}>
          Send invitation
        </Button>
      </div>
    </form>
  );
}

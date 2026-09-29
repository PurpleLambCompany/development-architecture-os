"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { updateOwnName } from "@/domain/profiles/actions";
import { profileNameSchema } from "@/domain/profiles/schemas";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type Values = z.infer<typeof profileNameSchema>;

export function ProfileForm({ firstName, lastName }: Values) {
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<Values>({
    resolver: zodResolver(profileNameSchema),
    defaultValues: { firstName, lastName },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setMessage(null);
    startTransition(async () => {
      const result = await updateOwnName(values);
      setMessage(
        result.ok ? { tone: "success", text: "Saved." } : { tone: "error", text: result.error },
      );
      if (result.ok) router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="firstName" error={errors.firstName?.message}>
          <Input id="firstName" aria-invalid={!!errors.firstName} {...form.register("firstName")} />
        </Field>
        <Field label="Last name" htmlFor="lastName" error={errors.lastName?.message}>
          <Input id="lastName" aria-invalid={!!errors.lastName} {...form.register("lastName")} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="secondary" disabled={pending}>
          Save
        </Button>
      </div>
    </form>
  );
}

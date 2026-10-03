"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { sendPasswordReset } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const schema = z.object({
  email: z.email("Enter a valid email address"),
});

type Values = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setMessage(null);
    startTransition(async () => {
      await sendPasswordReset(values);
      setMessage({
        tone: "success",
        text: "If this address has access, a password reset link is on its way.",
      });
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          {...form.register("email")}
        />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        Send reset link
      </Button>
    </form>
  );
}

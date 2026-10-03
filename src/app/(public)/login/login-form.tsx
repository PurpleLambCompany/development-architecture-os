"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { sendMagicLink, signInWithPassword } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const schema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string(),
});

type Values = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });
  const { errors } = form.formState;

  const onPasswordSignIn = form.handleSubmit((values) => {
    if (!values.password) {
      form.setError("password", { message: "Required" });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await signInWithPassword(values);
      if (!result.ok) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      router.replace("/");
      router.refresh();
    });
  });

  const onMagicLink = async () => {
    const valid = await form.trigger("email");
    if (!valid) return;
    setMessage(null);
    startTransition(async () => {
      await sendMagicLink({ email: form.getValues("email") });
      setMessage({
        tone: "success",
        text: "If this address has access, a sign-in link is on its way.",
      });
    });
  };

  return (
    <form onSubmit={onPasswordSignIn} className="space-y-5" noValidate>
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
      <Field label="Password" htmlFor="password" error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          {...form.register("password")}
        />
      </Field>
      <p className="-mt-2 text-right">
        <Link
          href="/forgot-password"
          className="text-xs text-ink-subtle underline hover:text-ink-muted"
        >
          Forgot your password?
        </Link>
      </p>
      <div className="flex flex-col gap-3 pt-1">
        <Button type="submit" disabled={pending}>
          Sign in
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={onMagicLink}>
          Email me a sign-in link instead
        </Button>
      </div>
    </form>
  );
}

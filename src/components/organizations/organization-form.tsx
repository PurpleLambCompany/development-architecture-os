"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { applyServerErrors } from "@/lib/forms";
import { createClientOrganization, updateOrganization } from "@/domain/organizations/actions";
import { ORGANIZATION_STATUSES } from "@/domain/organizations/schemas";
import { slugify, slugSchema } from "@/domain/shared/slug";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";

const schema = z.object({
  name: z.string().trim().min(1, "Required").max(200),
  slug: slugSchema,
  status: z.enum(ORGANIZATION_STATUSES),
});

type Values = z.infer<typeof schema>;

const STATUS_LABELS: Record<Values["status"], string> = {
  active: "Active",
  suspended: "Suspended (no access)",
  archived: "Archived",
};

export function OrganizationForm({
  organization,
}: {
  organization?: { id: string; name: string; slug: string; status: Values["status"] };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [slugTouched, setSlugTouched] = useState(Boolean(organization));
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: organization ?? { name: "", slug: "", status: "active" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = organization
        ? await updateOrganization(organization.id, values)
        : await createClientOrganization({ name: values.name, slug: values.slug });
      if (!result.ok) {
        setError(result.error);
        applyServerErrors(form, result);
        return;
      }
      if (!organization || result.data.slug !== organization.slug) {
        router.push(`/internal/organizations/${result.data.slug}`);
      } else {
        setSaved(true);
        router.refresh();
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      {saved ? <FormMessage tone="success">Saved.</FormMessage> : null}
      <Field label="Organization name" htmlFor="name" error={errors.name?.message}>
        <Input
          id="name"
          aria-invalid={!!errors.name}
          {...form.register("name", {
            onChange: (event) => {
              if (!slugTouched) form.setValue("slug", slugify(event.target.value));
            },
          })}
        />
      </Field>
      <Field
        label="Identifier"
        htmlFor="slug"
        hint="Used in links. Lowercase letters, numbers and hyphens."
        error={errors.slug?.message}
      >
        <Input
          id="slug"
          aria-invalid={!!errors.slug}
          {...form.register("slug", { onChange: () => setSlugTouched(true) })}
        />
      </Field>
      {organization ? (
        <Field label="Status" htmlFor="status" error={errors.status?.message}>
          <Select id="status" {...form.register("status")}>
            {ORGANIZATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {organization ? "Save changes" : "Create organization"}
        </Button>
      </div>
    </form>
  );
}

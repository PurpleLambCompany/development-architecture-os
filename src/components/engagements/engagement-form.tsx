"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createEngagement, updateEngagement } from "@/domain/engagements/actions";
import {
  ENGAGEMENT_STATUSES,
  ENGAGEMENT_STATUS_LABELS,
  ENGAGEMENT_TYPES,
  ENGAGEMENT_TYPE_LABELS,
} from "@/domain/engagements/catalog";
import { engagementUpdateSchema, type EngagementUpdateForm } from "@/domain/engagements/schemas";
import { slugify } from "@/domain/shared/slug";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";

// The form always validates the shared fields; the client organization is
// only chosen on create and is validated server-side as well.
const formSchema = z.object({
  clientOrganizationId: z.string(),
  values: engagementUpdateSchema,
});

type FormValues = { clientOrganizationId: string; values: EngagementUpdateForm };

const EMPTY: EngagementUpdateForm = {
  title: "",
  slug: "",
  engagementType: "development_architecture_sprint",
  objective: "",
  description: "",
  currentPhase: "",
  status: "proposed",
  startDate: "",
  targetEndDate: "",
};

type Props =
  | { mode: "create"; organizations: { id: string; name: string }[]; canArchive: boolean }
  | {
      mode: "edit";
      engagementId: string;
      initial: EngagementUpdateForm;
      canArchive: boolean;
    };

export function EngagementForm(props: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [slugTouched, setSlugTouched] = useState(props.mode === "edit");

  const form = useForm<FormValues, unknown, z.output<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientOrganizationId: "",
      values: props.mode === "edit" ? props.initial : EMPTY,
    },
  });
  const errors = form.formState.errors.values ?? {};
  const orgError = form.formState.errors.clientOrganizationId?.message;

  const statuses = ENGAGEMENT_STATUSES.filter(
    (status) =>
      status !== "archived" ||
      props.canArchive ||
      (props.mode === "edit" && props.initial.status === "archived"),
  );

  const onSubmit = form.handleSubmit(({ clientOrganizationId }) => {
    setError(null);
    // Send raw form values; the server re-validates and transforms.
    const raw = form.getValues("values");
    startTransition(async () => {
      const result =
        props.mode === "create"
          ? await createEngagement({ clientOrganizationId, ...raw })
          : await updateEngagement(props.engagementId, raw);
      if (!result.ok) {
        setError(result.error);
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          const path = field === "clientOrganizationId" ? field : `values.${field}`;
          form.setError(path as never, { type: "server", message });
        }
        return;
      }
      router.push(`/internal/engagements/${result.data.slug}`);
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      {props.mode === "create" ? (
        <Field label="Client organization" htmlFor="clientOrganizationId" error={orgError}>
          <Select
            id="clientOrganizationId"
            aria-invalid={!!orgError}
            {...form.register("clientOrganizationId", {
              validate: (value) => (value ? true : "Choose a client organization"),
            })}
          >
            <option value="">Select…</option>
            {props.organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Engagement title" htmlFor="title" error={errors.title?.message}>
          <Input
            id="title"
            aria-invalid={!!errors.title}
            {...form.register("values.title", {
              onChange: (event) => {
                if (!slugTouched) form.setValue("values.slug", slugify(event.target.value));
              },
            })}
          />
        </Field>
        <Field label="Identifier" htmlFor="slug" hint="Used in links." error={errors.slug?.message}>
          <Input
            id="slug"
            aria-invalid={!!errors.slug}
            {...form.register("values.slug", { onChange: () => setSlugTouched(true) })}
          />
        </Field>
        <Field
          label="Engagement type"
          htmlFor="engagementType"
          error={errors.engagementType?.message}
        >
          <Select id="engagementType" {...form.register("values.engagementType")}>
            {ENGAGEMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {ENGAGEMENT_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="status" error={errors.status?.message}>
          <Select id="status" {...form.register("values.status")}>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {ENGAGEMENT_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Start date" htmlFor="startDate" error={errors.startDate?.message}>
          <Input id="startDate" type="date" {...form.register("values.startDate")} />
        </Field>
        <Field
          label="Target end date"
          htmlFor="targetEndDate"
          error={errors.targetEndDate?.message}
        >
          <Input
            id="targetEndDate"
            type="date"
            aria-invalid={!!errors.targetEndDate}
            {...form.register("values.targetEndDate")}
          />
        </Field>
        <Field
          label="Current phase"
          htmlFor="currentPhase"
          hint="e.g. Knowledge Architecture"
          error={errors.currentPhase?.message}
        >
          <Input id="currentPhase" {...form.register("values.currentPhase")} />
        </Field>
      </div>

      <Field
        label="Project objective"
        htmlFor="objective"
        hint="One or two sentences the client will see."
        error={errors.objective?.message}
      >
        <Textarea id="objective" rows={3} {...form.register("values.objective")} />
      </Field>
      <Field
        label="Description and scope"
        htmlFor="description"
        error={errors.description?.message}
      >
        <Textarea id="description" rows={5} {...form.register("values.description")} />
      </Field>

      <div className="flex justify-end gap-2 border-t border-rule pt-5">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {props.mode === "create" ? "Create engagement" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

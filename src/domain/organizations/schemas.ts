import { z } from "zod";
import { slugSchema } from "@/domain/shared/slug";

export const ORGANIZATION_STATUSES = ["active", "suspended", "archived"] as const;

export const organizationInputSchema = z.object({
  name: z.string().trim().min(1, "Required").max(200, "At most 200 characters"),
  slug: slugSchema,
});

export const organizationUpdateSchema = organizationInputSchema.extend({
  status: z.enum(ORGANIZATION_STATUSES),
});

export type OrganizationInput = z.infer<typeof organizationInputSchema>;
export type OrganizationUpdate = z.infer<typeof organizationUpdateSchema>;

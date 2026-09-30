import { z } from "zod";
import { slugSchema } from "@/domain/shared/slug";
import { ENGAGEMENT_STATUSES, ENGAGEMENT_TYPES } from "./catalog";

const optionalDate = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Use YYYY-MM-DD")
  .transform((value) => (value === "" ? null : value));

const engagementFields = {
  title: z.string().trim().min(1, "Required").max(200, "At most 200 characters"),
  slug: slugSchema,
  engagementType: z.enum(ENGAGEMENT_TYPES, "Choose an engagement type"),
  objective: z.string().trim().max(2000, "At most 2,000 characters"),
  description: z.string().trim().max(10000, "At most 10,000 characters"),
  currentPhase: z.string().trim().max(120, "At most 120 characters"),
  status: z.enum(ENGAGEMENT_STATUSES),
  startDate: optionalDate,
  targetEndDate: optionalDate,
};

function datesOrdered(value: { startDate: string | null; targetEndDate: string | null }) {
  return !value.startDate || !value.targetEndDate || value.targetEndDate >= value.startDate;
}

const datesMessage = { message: "Must be on or after the start date", path: ["targetEndDate"] };

export const engagementCreateSchema = z
  .object({ clientOrganizationId: z.uuid("Choose a client organization"), ...engagementFields })
  .refine(datesOrdered, datesMessage);

export const engagementUpdateSchema = z.object(engagementFields).refine(datesOrdered, datesMessage);

/** Form values before transformation (dates as strings). */
export type EngagementCreateForm = z.input<typeof engagementCreateSchema>;
export type EngagementUpdateForm = z.input<typeof engagementUpdateSchema>;
export type EngagementCreateInput = z.output<typeof engagementCreateSchema>;
export type EngagementUpdateInput = z.output<typeof engagementUpdateSchema>;

/** Map validated input to database column names. */
export function toEngagementRow(input: EngagementUpdateInput) {
  return {
    title: input.title,
    slug: input.slug,
    engagement_type: input.engagementType,
    objective: input.objective,
    description: input.description,
    current_phase: input.currentPhase,
    status: input.status,
    start_date: input.startDate,
    target_end_date: input.targetEndDate,
  };
}

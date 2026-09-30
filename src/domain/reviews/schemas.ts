import { z } from "zod";
import { REVIEW_PARTICIPANT_ROLES, REVIEW_TYPES } from "./catalog";

/**
 * Form schemas for review actions. They give clear field errors; the
 * database operations (create_review, hold_review, ...) check every rule
 * again (capabilities, review status, relationship rules).
 */

const text = (max: number) =>
  z.string().trim().max(max, `At most ${max.toLocaleString()} characters`);
const required = (max: number, message = "Required") => text(max).min(1, message);
const id = z.uuid("Choose a record");
const optionalId = z
  .string()
  .trim()
  .default("")
  .refine((value) => value === "" || z.uuid().safeParse(value).success, "Choose a record")
  .transform((value) => (value === "" ? null : value));
/** A datetime-local input's value ("YYYY-MM-DDTHH:mm"), sent to the database as-is. */
const optionalDateTime = z
  .string()
  .trim()
  .default("")
  .refine(
    (value) => value === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value),
    "Enter a date and time",
  )
  .transform((value) => (value === "" ? null : value));

export const createReviewSchema = z.object({
  reviewType: z.enum(REVIEW_TYPES, "Choose the kind of review"),
  title: required(300),
  scheduledFor: optionalDateTime,
  baselineId: optionalId,
  summary: text(4000),
});

export const addParticipantSchema = z.object({
  engagementMemberId: id,
  role: z.enum(REVIEW_PARTICIPANT_ROLES).default("attendee"),
});

export const holdReviewSchema = z.object({
  heldAt: optionalDateTime,
  summary: text(4000),
});

export const cancelReviewSchema = z.object({
  reason: required(2000, "Say why the review is cancelled"),
});

export const recordValidationSchema = z.object({
  initiativeElementId: id,
});

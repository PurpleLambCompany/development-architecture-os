import { z } from "zod";
import { isIsoDate } from "@/domain/finance/business-date";
import { ATTENTION_LEVELS, ESCALATION_LEVELS } from "@/domain/intelligence/catalog";
import {
  IMPLEMENTATION_CATEGORIES,
  IMPLEMENTATION_CHECKPOINT_TYPES,
  NON_TERMINAL_STATUSES,
  TERMINAL_STATUSES,
} from "./catalog";

/**
 * Form schemas for implementation actions. They give clear field errors;
 * the database operations check every rule again (capabilities, the
 * validated status's qualifying-relationship requirement, terminal-status
 * protection).
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
const optionalDate = z
  .string()
  .trim()
  .default("")
  .refine((value) => value === "" || isIsoDate(value), "Enter a date (YYYY-MM-DD)")
  .transform((value) => (value === "" ? null : value));
/** Checkbox groups send a string for one value and an array for several. */
const idList = z.preprocess(
  (value) =>
    value === undefined || value === "" || value === false
      ? []
      : typeof value === "string"
        ? [value]
        : value,
  z.array(z.uuid("Choose an element")).max(50),
);

const CATEGORY_KEYS = IMPLEMENTATION_CATEGORIES.map((c) => c.key) as [string, ...string[]];

/** Direct edits to the initiative's own working fields (manage_implementation). */
export const updateInitiativeDetailsSchema = z.object({
  category: z.enum(CATEGORY_KEYS).default("other"),
  targetOperationalOn: optionalDate,
  ownerMemberId: optionalId,
});

export const createInitiativeSchema = z.object({
  title: required(300),
  implementsElementIds: idList.refine(
    (v) => v.length > 0,
    "Choose what this initiative implements",
  ),
  category: z.enum(CATEGORY_KEYS).default("other"),
  targetOperationalOn: optionalDate,
  ownerMemberId: optionalId,
  summary: text(4000),
});

export const updateStatusSchema = z.object({
  status: z.enum(NON_TERMINAL_STATUSES, "Choose a status"),
  rationale: text(4000),
});

export const resolveInitiativeSchema = z.object({
  status: z.enum(TERMINAL_STATUSES, "Choose how it is resolved"),
  rationale: required(4000, "Give the rationale"),
});

export const reopenInitiativeSchema = z.object({
  rationale: required(4000, "Give the rationale"),
});

export const triageSchema = z
  .object({
    attention: z.enum(ATTENTION_LEVELS, "Choose the attention it needs"),
    nextReviewOn: optionalDate,
    note: text(2000),
  })
  .refine((v) => v.attention !== "critical" || v.note.length > 0, {
    path: ["note"],
    message: "Say why it is critical",
  });

export const escalateSchema = z
  .object({
    level: z.enum(ESCALATION_LEVELS, "Choose a level"),
    reason: required(4000, "Give the reason"),
    addresseeMemberId: optionalId,
    dueOn: optionalDate,
  })
  .refine((v) => v.level !== "client_executive" || v.addresseeMemberId, {
    path: ["addresseeMemberId"],
    message: "Choose the client executive",
  });

export const noteSchema = z.object({ note: required(2000, "Write a note") });
export const optionalNoteSchema = z.object({ note: text(2000) });

export const dismissSignalSchema = z.object({
  elementId: id,
  fingerprint: required(500),
  reason: required(2000, "Say why it needs no action"),
  expiresOn: optionalDate,
});

export const addCheckpointSchema = z.object({
  checkpointType: z.enum(IMPLEMENTATION_CHECKPOINT_TYPES, "Choose the kind of checkpoint"),
  title: required(200),
  targetOn: optionalDate,
  relatedReviewId: optionalId,
  relatedApprovalId: optionalId,
  clientVisible: z
    .string()
    .default("no")
    .transform((value) => value === "yes" || value === "true" || value === "on"),
});

export const recordCheckpointAchievedSchema = z.object({
  achievedOn: optionalDate,
  achievedEvidenceSourceId: optionalId,
});

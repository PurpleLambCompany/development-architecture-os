import { z } from "zod";
import { DOMAINS, EVIDENCE_STANCES } from "@/domain/architecture/catalog";
import { isIsoDate } from "@/domain/finance/business-date";
import {
  ATTENTION_LEVELS,
  ESCALATION_LEVELS,
  SENDABLE_CLIENT_ACTION_KINDS,
  SIGNAL_RULES,
  SUBJECT_REQUIRED_KINDS,
} from "./catalog";

/**
 * Form schemas for Project Intelligence actions. They give clear field
 * errors; the database operations check every rule again (capabilities,
 * addressees, areas, statuses, publication).
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
const httpsUrl = z
  .string()
  .trim()
  .default("")
  .refine((v) => v === "" || /^https:\/\/\S+$/.test(v), "Use an https:// address")
  .transform((v) => (v === "" ? null : v));
const yesNo = z
  .string()
  .default("no")
  .transform((value) => value === "yes" || value === "true" || value === "on");
/** Checkbox groups send a string for one value and an array for several. */
const idList = z.preprocess(
  (value) =>
    value === undefined || value === "" || value === false
      ? []
      : typeof value === "string"
        ? [value]
        : value,
  z.array(z.uuid("Choose a record")).max(50),
);

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

export const resolveSchema = z.object({
  status: required(40, "Choose how it is resolved"),
  rationale: required(4000, "Give the rationale"),
  publish: yesNo,
  changeSummary: text(2000),
});

export const reopenSchema = z.object({
  status: required(40, "Choose the status it returns to"),
  rationale: required(4000, "Give the rationale"),
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

export const sendClientActionSchema = z
  .object({
    kind: z.enum(SENDABLE_CLIENT_ACTION_KINDS, "Choose the kind of request"),
    title: required(200),
    request: required(4000, "Write the request"),
    addresseeMemberId: id,
    dueOn: optionalDate,
    subjectIds: idList,
  })
  .refine(
    (v) =>
      !(SUBJECT_REQUIRED_KINDS as readonly string[]).includes(v.kind) || v.subjectIds.length > 0,
    { path: ["subjectIds"], message: "Choose what the client should confirm or review" },
  );

export const reassignSchema = z.object({
  memberId: id,
  note: text(2000),
});

export const respondSchema = z.object({
  body: required(8000, "Write your response"),
  linkUrl: httpsUrl,
  fileIds: idList,
});

export const recordAsEvidenceSchema = z.object({
  title: text(300),
  statementId: optionalId,
  stance: z.enum(EVIDENCE_STANCES).default("supports"),
});

export const contributionSchema = z.object({
  body: required(8000, "Write your input"),
  linkUrl: httpsUrl,
  fileIds: idList,
});

export const handleContributionSchema = z
  .object({
    status: z.enum(["incorporated", "acknowledged"], "Choose how it was handled"),
    note: required(2000, "Write a note for the contributor"),
    recordAsEvidence: yesNo,
    statementId: optionalId,
  })
  .refine((v) => !v.recordAsEvidence || v.status === "incorporated", {
    path: ["recordAsEvidence"],
    message: "Only incorporated input is recorded as evidence",
  });

export const areaSchema = z
  .object({
    domain: z
      .enum([...DOMAINS, ""])
      .default("")
      .transform((v) => (v === "" ? null : v)),
    elementId: optionalId,
  })
  .refine((v) => (v.domain === null) !== (v.elementId === null), {
    path: ["domain"],
    message: "Choose a domain or an element",
  });

export const dismissSignalSchema = z.object({
  ruleKey: z.enum(SIGNAL_RULES),
  elementId: optionalId,
  clientActionId: optionalId,
  fingerprint: required(500),
  reason: required(2000, "Say why it needs no action"),
  expiresOn: optionalDate,
});

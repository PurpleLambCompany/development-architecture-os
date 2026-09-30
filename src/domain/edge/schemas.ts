import { z } from "zod";
import { isIsoDate } from "@/domain/finance/business-date";
import { JUDGMENT_KINDS } from "./items";

/**
 * Form schemas for Development Edge judgments and the briefing mark. They
 * give clear field errors; the database operations check capability,
 * fingerprint currency and every rule again.
 */

const text = (max: number) =>
  z.string().trim().max(max, `At most ${max.toLocaleString()} characters`);
const optionalDate = z
  .string()
  .trim()
  .default("")
  .refine((value) => value === "" || isIsoDate(value), "Enter a date (YYYY-MM-DD)")
  .transform((value) => (value === "" ? null : value));

export const judgmentSchema = z
  .object({
    kind: z.enum(JUDGMENT_KINDS.filter((k) => k !== "promoted") as [string, ...string[]]),
    reason: text(2000).default(""),
    expiresOn: optionalDate,
  })
  .superRefine((v, ctx) => {
    if (v.kind !== "investigating" && v.reason === "") {
      ctx.addIssue({ code: "custom", path: ["reason"], message: "Say why" });
    }
    if (v.kind === "deferred" && !v.expiresOn) {
      ctx.addIssue({
        code: "custom",
        path: ["expiresOn"],
        message: "Choose the date it should return",
      });
    }
    if (v.kind !== "deferred" && v.expiresOn) {
      ctx.addIssue({ code: "custom", path: ["expiresOn"], message: "Only a deferral has a date" });
    }
  });

export const markBriefedSchema = z.object({
  through: z.iso.datetime({ offset: true, message: "Choose a time" }),
});

export type EdgeItemRef = {
  ruleKey: string;
  subjectType: string;
  subjectId: string;
  fingerprint: string;
};

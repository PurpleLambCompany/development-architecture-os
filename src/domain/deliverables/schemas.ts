import { z } from "zod";
import { DELIVERABLE_TYPES } from "./catalog";

/**
 * Form schemas for deliverable actions. They give clear field errors; the
 * database operations (create_deliverable, attach_deliverable_file) check
 * every rule again (capabilities, publication state).
 */

const text = (max: number) =>
  z.string().trim().max(max, `At most ${max.toLocaleString()} characters`);
const required = (max: number, message = "Required") => text(max).min(1, message);
const optionalId = z
  .string()
  .trim()
  .default("")
  .refine((value) => value === "" || z.uuid().safeParse(value).success, "Choose a record")
  .transform((value) => (value === "" ? null : value));
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
  z.array(z.uuid("Choose a file")).max(50),
);

export const createDeliverableSchema = z.object({
  deliverableType: z.enum(DELIVERABLE_TYPES, "Choose the kind of deliverable"),
  title: required(300),
  baselineId: optionalId,
  confidential: yesNo,
  summary: text(4000),
});

export const attachDeliverableFileSchema = z.object({
  fileIds: idList.refine((v) => v.length > 0, "Choose at least one file"),
});

/** Direct edits to the deliverable's own working fields (manage_deliverables). */
export const updateDeliverableSchema = z.object({
  deliverableType: z.enum(DELIVERABLE_TYPES, "Choose the kind of deliverable"),
  baselineId: optionalId,
  confidential: yesNo,
});

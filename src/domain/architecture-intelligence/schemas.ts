import { z } from "zod";
import { DATA_CLASSES } from "./types";

/**
 * The authorization form (proposal §5.2). The database operation enforces
 * every rule (who may act, eligible status, synthetic basis, no future
 * date, a reason for revocation); this only gives clear field messages.
 */

export const BASIS_KINDS = [
  "client_agreement",
  "data_processing_addendum",
  "written_client_instruction",
  "synthetic_evaluation",
] as const;

export const BASIS_KIND_LABELS: Record<(typeof BASIS_KINDS)[number], string> = {
  client_agreement: "Client agreement",
  data_processing_addendum: "Data processing addendum",
  written_client_instruction: "Written client instruction",
  synthetic_evaluation: "Synthetic evaluation",
};

export const DATA_CLASS_LABELS: Record<(typeof DATA_CLASSES)[number], string> = {
  published_architecture: "Published architecture",
  working_architecture: "Working architecture",
  project_intelligence: "Project Intelligence",
  evidence_metadata: "Evidence metadata (never file contents)",
};

/** A field the form may leave blank or not render at all. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

export const authorizationSchema = z.discriminatedUnion("state", [
  z.object({
    state: z.literal("authorized"),
    dataClasses: z.array(z.enum(DATA_CLASSES)).min(1, "Choose at least one data class"),
    providerKey: z.string().trim().min(1, "Name the provider").max(40),
    processingRegion: z.string().trim().min(1, "Name the processing region").max(40),
    basisKind: z.enum(BASIS_KINDS, "Choose the basis"),
    basisReference: z.string().trim().min(1, "Give the basis reference").max(200),
    basisNote: optionalText(2000),
    monthlyBudgetUsd: z.coerce
      .number("Give a monthly budget in US dollars")
      .positive("The budget must be more than zero"),
    effectiveFrom: optionalText(10),
  }),
  z.object({
    state: z.literal("not_authorized"),
    basisNote: z.string().trim().min(1, "Say why").max(2000),
    effectiveFrom: optionalText(10),
  }),
]);

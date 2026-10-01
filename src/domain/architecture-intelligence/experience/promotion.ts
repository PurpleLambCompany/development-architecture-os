import "server-only";
import type { FieldSpec } from "@/components/ui/action-form";
import { getInferenceDetail } from "./queries";
import { KIND_NOUNS } from "./words";

/**
 * Promotion from a kept interpretation (IX-20, 7B.2 proposal §19). The
 * governed form opens without model text: its default names only the kind
 * and the records it is about. The person may choose to bring the
 * interpretation's text, which enters the new record as an `ai_analysis`
 * statement, pending under the AI review gate. The interpretation is judged
 * `promoted` only once the governed record exists.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type InferencePromotion = { inferenceId: string; elementId: string; line: string };

/** The kept, current interpretation a page was opened to promote, or null. */
export async function inferencePromotionFromQuery(
  engagementId: string,
  query: Record<string, string | string[] | undefined>,
  codeOf: (elementId: string) => string | null | undefined,
): Promise<InferencePromotion | null> {
  const id = query.promoteInference;
  if (typeof id !== "string" || !UUID.test(id)) return null;
  const detail = await getInferenceDetail(engagementId, id);
  if (!detail || detail.state !== "current") return null;
  const codes = [detail.subject.element_id, detail.subject.second_element_id]
    .filter((v): v is string => typeof v === "string")
    .map((e) => codeOf(e))
    .filter(Boolean)
    .join(" and ");
  return {
    inferenceId: id,
    elementId: detail.subject.element_id!,
    line: `${KIND_NOUNS[detail.inference_kind] ?? "Interpretation"} on ${codes || "a record"}`,
  };
}

export const bringTextField: FieldSpec = {
  name: "bringInterpretationText",
  label: "Bring interpretation text",
  type: "select",
  options: [
    { value: "no", label: "No: start from the governed form only" },
    { value: "yes", label: "Yes: add it as AI analysis, pending review" },
  ],
  hint: "If brought, the interpretation's words enter this record as an AI-analysis statement that must be reviewed before it can be published.",
  wide: true,
};

import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import type { ActionResult } from "@/lib/action-result";

/** Push server-side field errors back into a react-hook-form instance. */
export function applyServerErrors<T extends FieldValues>(
  form: UseFormReturn<T, unknown, FieldValues>,
  result: Extract<ActionResult<unknown>, { ok: false }>,
) {
  for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
    form.setError(field as Path<T>, { type: "server", message });
  }
}

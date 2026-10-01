"use server";

import { revalidatePath } from "next/cache";
import { fromDatabaseError, fromZodError, ok } from "@/lib/action-result";
import { requireViewer } from "@/lib/auth/viewer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizationSchema } from "./schemas";

/**
 * Record a new external-processing authorization for an engagement, or a
 * revocation. One database operation, as the signed-in user: it checks
 * authorize_external_ai_processing and every rule, and appends a version;
 * nothing is ever edited or deleted (ADR-0060). This sends nothing to any
 * provider. There is no other Architecture Intelligence action in 7B.1.
 */
export async function setEngagementAiAuthorization(
  engagementId: string,
  input: Record<string, unknown>,
) {
  await requireViewer();
  const parsed = authorizationSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const v = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(
    "set_engagement_ai_authorization",
    v.state === "authorized"
      ? {
          p_engagement_id: engagementId,
          p_state: v.state,
          p_data_classes: v.dataClasses,
          p_provider_key: v.providerKey,
          p_processing_region: v.processingRegion,
          p_basis_kind: v.basisKind,
          p_basis_reference: v.basisReference,
          p_basis_note: v.basisNote ?? undefined,
          p_monthly_budget_usd: v.monthlyBudgetUsd,
          p_effective_from: v.effectiveFrom ?? undefined,
        }
      : {
          p_engagement_id: engagementId,
          p_state: v.state,
          p_basis_note: v.basisNote,
          p_effective_from: v.effectiveFrom ?? undefined,
        },
  );
  if (error) return fromDatabaseError(error);
  revalidatePath("/internal", "layout");
  return ok(undefined);
}

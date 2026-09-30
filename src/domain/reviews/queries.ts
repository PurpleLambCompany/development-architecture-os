import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

/**
 * Review reads. Every query runs as the signed-in user: row-level security
 * and the read models decide what comes back.
 */

type Tables = Database["public"]["Tables"];
type Row<T extends keyof Tables> = Tables[T]["Row"];

export type ReviewRegisterRow =
  Database["public"]["Functions"]["review_register"]["Returns"][number];
export type ReviewParticipantRow = Row<"review_participants">;
export type ClientReviewRow = Database["public"]["Functions"]["client_reviews"]["Returns"][number];

/** Every review the viewer may read: one engagement, or all of them (internal only). */
export const getReviewRegister = cache(
  async (engagementId: string | null): Promise<ReviewRegisterRow[]> => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(
      "review_register",
      engagementId ? { p_engagement_id: engagementId } : {},
    );
    if (error) throw error;
    return data ?? [];
  },
);

export const getReviewParticipants = cache(
  async (elementId: string): Promise<ReviewParticipantRow[]> => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("review_participants")
      .select("*")
      .eq("element_id", elementId)
      .order("added_at");
    if (error) throw error;
    return data ?? [];
  },
);

/** Reviews that examine a given element (for offering a validation source). */
export const getExaminingReviews = cache(async (elementId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("architecture_relationships")
    .select(
      "source_element_id, architecture_elements!architecture_relationships_source_fk(id, reference_code, title, engagement_id)",
    )
    .eq("target_element_id", elementId)
    .eq("relationship_type", "examines")
    .is("retired_at", null);
  if (error) throw error;
  return data ?? [];
});

/** Published, client-visible reviews of an engagement. */
export async function getClientReviews(engagementId: string): Promise<ClientReviewRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("client_reviews", { p_engagement_id: engagementId });
  if (error) throw error;
  return data ?? [];
}

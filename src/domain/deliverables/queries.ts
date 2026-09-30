import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

/**
 * Deliverable reads. Every query runs as the signed-in user: row-level
 * security and the read models decide what comes back.
 */

type Tables = Database["public"]["Tables"];
type Row<T extends keyof Tables> = Tables[T]["Row"];

export type DeliverableRegisterRow =
  Database["public"]["Functions"]["deliverable_register"]["Returns"][number];
export type ClientDeliverableRow =
  Database["public"]["Functions"]["client_deliverables"]["Returns"][number];
export type EngagementFileRow = Row<"engagement_files">;

/** Every deliverable the viewer may read: one engagement, or all (internal only). */
export const getDeliverableRegister = cache(
  async (engagementId: string | null): Promise<DeliverableRegisterRow[]> => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(
      "deliverable_register",
      engagementId ? { p_engagement_id: engagementId } : {},
    );
    if (error) throw error;
    return data ?? [];
  },
);

/** Files attached to a published deliverable's element version. */
export const getDeliverableFiles = cache(
  async (elementVersionId: string): Promise<EngagementFileRow[]> => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("engagement_files")
      .select("*")
      .eq("element_version_id", elementVersionId)
      .order("created_at");
    if (error) throw error;
    return data ?? [];
  },
);

/** Published, client-visible deliverables of an engagement (confidential ones gated by RLS). */
export async function getClientDeliverables(engagementId: string): Promise<ClientDeliverableRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("client_deliverables", {
    p_engagement_id: engagementId,
  });
  if (error) throw error;
  return data ?? [];
}

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

export type DeliverableFile = {
  id: string;
  filename: string;
  size_bytes: number;
  created_at: string;
  version_id: string;
  version_no: number;
};

/**
 * Files attached to any published version of a deliverable, newest version
 * first (D9). Each file stays with the version it was attached to; a later
 * publication neither copies nor hides it. Row-level security decides which
 * files the viewer may see (for a client: only those of a deliverable they
 * can read).
 */
export const getDeliverableFiles = cache(async (elementId: string): Promise<DeliverableFile[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("engagement_files")
    .select(
      "id, filename, size_bytes, created_at, element_version_id, element_versions!inner(version_no, element_id)",
    )
    .eq("element_versions.element_id", elementId)
    .eq("purpose", "deliverable")
    .order("created_at");
  if (error) throw error;
  return (data ?? [])
    .map((f) => ({
      id: f.id,
      filename: f.filename,
      size_bytes: f.size_bytes,
      created_at: f.created_at,
      version_id: f.element_version_id!,
      version_no: f.element_versions.version_no,
    }))
    .sort((a, b) => b.version_no - a.version_no);
});

/** Version numbers of published versions the viewer may read, by version id. */
export async function getVersionNumbers(
  versionIds: readonly string[],
): Promise<Map<string, number>> {
  if (versionIds.length === 0) return new Map();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("element_versions")
    .select("id, version_no")
    .in("id", [...versionIds]);
  if (error) throw error;
  return new Map((data ?? []).map((v) => [v.id, v.version_no]));
}

/** Published, client-visible deliverables of an engagement (confidential ones gated by RLS). */
export async function getClientDeliverables(engagementId: string): Promise<ClientDeliverableRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("client_deliverables", {
    p_engagement_id: engagementId,
  });
  if (error) throw error;
  return data ?? [];
}

import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

/**
 * Implementation reads. Every query runs as the signed-in user:
 * row-level security and the read models decide what comes back. Internal
 * readers see stewardship, history, escalations, signals and checkpoints;
 * clients see only published, client-visible rows and checkpoints.
 */

type Tables = Database["public"]["Tables"];
type Row<T extends keyof Tables> = Tables[T]["Row"];

export type ImplementationRegisterRow =
  Database["public"]["Functions"]["implementation_register"]["Returns"][number];
export type ImplementationSignalRow =
  Database["public"]["Functions"]["implementation_signals"]["Returns"][number];
export type ClientImplementationRow =
  Database["public"]["Functions"]["client_implementation"]["Returns"][number];
export type EscalationRow = Row<"implementation_escalations">;
export type StewardshipRow = Row<"implementation_stewardship">;
export type StatusChangeRow = Row<"implementation_status_changes">;
export type CheckpointRow = Row<"implementation_checkpoints">;

/** Every initiative the viewer may read: one engagement, or all (internal only). */
export const getImplementationRegister = cache(
  async (engagementId: string | null): Promise<ImplementationRegisterRow[]> => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(
      "implementation_register",
      engagementId ? { p_engagement_id: engagementId } : {},
    );
    if (error) throw error;
    return data ?? [];
  },
);

/** Signals for an engagement (internal only), optionally with dismissed ones. */
export const getImplementationSignals = cache(
  async (engagementId: string, includeDismissed = false): Promise<ImplementationSignalRow[]> => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("implementation_signals", {
      p_engagement_id: engagementId,
      p_include_dismissed: includeDismissed,
    });
    if (error) throw error;
    return data ?? [];
  },
);

export async function getStewardship(elementId: string): Promise<StewardshipRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("implementation_stewardship")
    .select("*")
    .eq("element_id", elementId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getStatusHistory(elementId: string): Promise<StatusChangeRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("implementation_status_changes")
    .select("*")
    .eq("element_id", elementId)
    .order("changed_at");
  if (error) throw error;
  return data ?? [];
}

/** Escalations of an engagement, or open ones across every engagement the viewer reads. */
export const getEscalations = cache(async (engagementId: string | null, openOnly = false) => {
  const supabase = await createSupabaseServerClient();
  // Note: implementation_escalations_element_fk references implementation_initiatives,
  // not architecture_elements directly (escalations only ever concern initiatives), so
  // there is no single-hop embed to architecture_elements here. No current caller reads
  // an `.architecture_elements` field off an escalation row (the initiative is already
  // in hand on the page that renders these), so that embed is simply dropped rather than
  // resolved via a two-hop traversal nobody would consume.
  let query = supabase
    .from("implementation_escalations")
    .select(`*, client_actions!implementation_escalations_action_fk(id, reference_code, status)`)
    .order("raised_at", { ascending: false });
  if (engagementId) query = query.eq("engagement_id", engagementId);
  if (openOnly) query = query.is("resolved_at", null);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
});

export type LoadedEscalation = Awaited<ReturnType<typeof getEscalations>>[number];

export const getCheckpoints = cache(async (elementId: string): Promise<CheckpointRow[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("implementation_checkpoints")
    .select("*")
    .eq("implementation_element_id", elementId)
    .order("target_on", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
});

/** Published, client-visible initiatives of an engagement, with their published checkpoints. */
export async function getClientImplementation(
  engagementId: string,
): Promise<ClientImplementationRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("client_implementation", {
    p_engagement_id: engagementId,
  });
  if (error) throw error;
  return data ?? [];
}

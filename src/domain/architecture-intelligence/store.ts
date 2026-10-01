import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ToolFunction } from "./tools/registry";
import type { ContextRow } from "./types";

/**
 * Everything the Gateway asks of the database. Reads run as the requesting
 * user (ADR-0005). Recording is the one exception (ADR-0069, 7B.2): it goes
 * through the server-only recording path, record_architecture_intelligence_
 * request_for, which only the service role may execute and which records as
 * the verified requester with every check of the recording operation. No
 * browser session can record, so no browser can supply model text.
 */

export type Standing = {
  canUse: boolean;
  canAuthorize: boolean;
  dataOrigin: "real" | "synthetic";
  engagementStatus: string;
  authorizationId: string | null;
  authorizationState: "authorized" | "not_authorized";
  dataClasses: string[];
  providerKey: string | null;
  processingRegion: string | null;
  monthlyBudgetUsd: number | null;
};

export type DbError = { code: string; message: string };

export interface ArchitectureIntelligenceStore {
  standing(engagementId: string): Promise<Standing | null>;
  monthToDateUsd(engagementId: string): Promise<number | null>;
  callTool(
    fn: ToolFunction,
    params: Record<string, unknown>,
  ): Promise<{ rows: ContextRow[] } | { error: DbError }>;
  /** An element of the engagement by reference code, or null. */
  elementByReference(engagementId: string, referenceCode: string): Promise<string | null>;
  record(
    engagementId: string,
    request: Record<string, unknown>,
    inference: Record<string, unknown> | null,
  ): Promise<{ requestId: string } | { error: DbError }>;
}

type Client = SupabaseClient<Database>;

export type TrustedRecord = ArchitectureIntelligenceStore["record"];

/**
 * The server-only recording path. `server` creates the service-role client,
 * which the DSA server alone holds; it is created only when a request is
 * recorded and used for exactly this one call and nothing else in
 * Architecture Intelligence. `requestedBy` is the signed-in user's id as the
 * Auth server verified it, never a value from a request.
 */
export function trustedRecording(server: () => Client, requestedBy: string): TrustedRecord {
  return async (engagementId, request, inference) => {
    const { data, error } = await server().rpc("record_architecture_intelligence_request_for", {
      p_requested_by: requestedBy,
      p_engagement_id: engagementId,
      p_request: request as never,
      ...(inference ? { p_inference: inference as never } : {}),
    });
    if (error || !data)
      return { error: { code: error?.code ?? "", message: error?.message ?? "" } };
    return { requestId: data };
  };
}

/** A store for reads only: it cannot record. */
const noRecording: TrustedRecord = async () => ({
  error: { code: "42501", message: "Recording is server-only" },
});

export function supabaseStore(
  supabase: Client,
  record: TrustedRecord = noRecording,
): ArchitectureIntelligenceStore {
  return {
    async standing(engagementId) {
      const { data, error } = await supabase.rpc("architecture_intelligence_standing", {
        p_engagement_id: engagementId,
      });
      const row = data?.[0];
      if (error || !row) return null;
      return {
        canUse: row.can_use,
        canAuthorize: row.can_authorize,
        dataOrigin: row.data_origin === "synthetic" ? "synthetic" : "real",
        engagementStatus: row.engagement_status,
        authorizationId: row.authorization_id,
        authorizationState:
          row.authorization_state === "authorized" ? "authorized" : "not_authorized",
        dataClasses: row.data_classes ?? [],
        providerKey: row.provider_key,
        processingRegion: row.processing_region,
        monthlyBudgetUsd: row.monthly_budget_usd === null ? null : Number(row.monthly_budget_usd),
      };
    },
    async monthToDateUsd(engagementId) {
      const { data, error } = await supabase.rpc("architecture_intelligence_budget", {
        p_engagement_id: engagementId,
      });
      const row = data?.[0];
      if (error || !row) return null;
      return Number(row.month_to_date_usd);
    },
    async callTool(fn, params) {
      // fn is one of the ten Tool Contract functions (the registry's type).
      const { data, error } = await supabase.rpc(fn, params as never);
      if (error) return { error: { code: error.code, message: error.message } };
      return { rows: (data ?? []) as ContextRow[] };
    },
    async elementByReference(engagementId, referenceCode) {
      const { data } = await supabase
        .from("architecture_elements")
        .select("id")
        .eq("engagement_id", engagementId)
        .eq("reference_code", referenceCode)
        .maybeSingle();
      return data?.id ?? null;
    },
    record,
  };
}

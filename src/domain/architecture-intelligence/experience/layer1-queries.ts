import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Deterministic layer-1 read models (7B.2 proposal §7, §8, PD-9). Readable
 * by every internal reader of the engagement's architecture, whether or not
 * they hold Architecture Intelligence; no provider, no audit row, no budget.
 */

export type SupportsAndExposures = {
  evidence: {
    link_id: string;
    link_type: "element_link" | "statement_link";
    stance: string;
    evidence_id: string;
    evidence_title: string;
    source_type: string;
    source_date: string | null;
    has_summary: boolean;
    linked_at: string;
    statement_id: string | null;
  }[];
  assumptions: {
    element_id: string;
    reference_code: string;
    title: string;
    validation_status: string;
    has_supporting_evidence: boolean;
  }[];
  risks: {
    element_id: string;
    reference_code: string;
    title: string;
    risk_status: string;
    severity: number | null;
  }[];
  edge: {
    item_key: string;
    rule_key: string;
    tier: string;
    fingerprint: string;
    trigger_reference_code: string | null;
  }[];
};

export async function getSupportsAndExposures(
  engagementId: string,
  elementId: string,
): Promise<SupportsAndExposures> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("element_supports_and_exposures", {
    p_engagement_id: engagementId,
    p_element_id: elementId,
  });
  if (error) throw error;
  return data as unknown as SupportsAndExposures;
}

export type ReviewDossier = {
  review: {
    id: string;
    reference_code: string;
    title: string;
    status: string;
    review_on: string | null;
    held_at: string | null;
    scheduled_for: string | null;
  };
  examined: {
    ordinal: number;
    element_id: string;
    reference_code: string;
    title: string;
    kind: string;
    examined_version_id: string | null;
    examined_version_no: number | null;
    latest_version_no: number | null;
    compare_basis: "captured_at_hold" | "prior_review" | "first_review" | "no_capture";
    compare_at: string | null;
    compare_version_no: number | null;
    prior_review_code: string | null;
  }[];
  changes: {
    element_id: string;
    version_id: string;
    reference_code: string;
    version_no: number;
    change_type: string;
    changed_paths: string[] | null;
    change_summary: string | null;
    published_at: string;
  }[];
  evidence: {
    element_id: string;
    reference_code: string;
    link_id: string;
    link_type: string;
    stance: string;
    evidence_title: string;
    source_type: string;
    linked_at: string;
  }[];
  edge: {
    item_key: string;
    rule_key: string;
    tier: string;
    subject_id: string;
    fingerprint: string;
    resolving_act: string;
    subject_reference_code: string | null;
    trigger_reference_code: string | null;
    trigger_version_no: number | null;
  }[];
  edge_judged_count: number;
  criteria: {
    criterion_id: string;
    reference_code: string;
    governs: string;
    governed_element_id: string;
    state: string;
    in_force: boolean;
    agreed_on: string | null;
    changed_since: boolean;
  }[];
  implementation: {
    initiative_id: string;
    reference_code: string;
    kind: "status_change" | "checkpoint_achieved" | "checkpoint_missed";
    from_value?: string | null;
    to_value?: string | null;
    title?: string;
    target_on?: string | null;
    achieved_on?: string | null;
    at?: string;
  }[];
  unresolved: {
    decisions: {
      element_id: string;
      reference_code: string;
      title?: string;
      needed_by: string | null;
    }[];
    escalations: {
      element_id: string;
      reference_code: string;
      level: string;
      source: string;
      raised_at: string;
    }[];
    deferred_edge: {
      rule_key: string;
      subject_reference_code: string | null;
      expires_on: string;
    }[];
  };
};

export async function getReviewDossier(
  engagementId: string,
  reviewId: string,
): Promise<ReviewDossier | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("review_dossier", {
    p_engagement_id: engagementId,
    p_review_id: reviewId,
  });
  if (error) {
    // C3: logged, not swallowed. Callers show a calm "could not be
    // prepared" state rather than letting the dossier silently disappear.
    console.error("review_dossier failed", { engagementId, reviewId, error });
    return null;
  }
  return data as unknown as ReviewDossier;
}

/** One statement's text, as the signed-in user may read it (RLS). */
export async function getStatementBody(statementId: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("architecture_statements")
    .select("body")
    .eq("id", statementId)
    .maybeSingle();
  return data?.body ?? null;
}

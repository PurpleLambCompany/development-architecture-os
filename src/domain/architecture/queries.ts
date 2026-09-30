import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";
import {
  approvalState,
  type ApprovalState,
  type ArchitectureDomain,
  type RecordKind,
} from "./catalog";
import type { ClientSnapshot, InternalSnapshot } from "./snapshot";

/**
 * Architecture reads. Every query runs as the signed-in user, so row-level
 * security decides what comes back: internal readers see the working
 * architecture of engagements they can access; clients see only published
 * versions through the client read models, never the working tables.
 */

type Tables = Database["public"]["Tables"];
type Row<T extends keyof Tables> = Tables[T]["Row"];

export type ElementRow = Row<"architecture_elements">;
export type ObjectRow = Row<"architecture_objects">;
export type RelationshipRow = Row<"architecture_relationships">;
export type VersionRow = Omit<Row<"element_versions">, "snapshot">;
export type ApprovalRow = Row<"architecture_approvals">;

export type RecordDetails =
  | { kind: "assumption"; row: Row<"assumptions"> }
  | { kind: "risk"; row: Row<"risks"> }
  | { kind: "constraint"; row: Row<"constraints"> }
  | { kind: "dependency"; row: Row<"dependencies"> }
  | { kind: "decision"; row: Row<"decisions"> }
  | { kind: "recommendation"; row: Row<"recommendations"> };

export type LoadedElement = ElementRow & {
  object: ObjectRow | null;
  record: RecordDetails | null;
  /** The object's domain, or the domains a record is scoped to. */
  domains: ArchitectureDomain[];
  versions: VersionRow[];
  latestVersion: VersionRow | null;
  /** Approval of the latest published version. */
  latestApproval: ApprovalRow | null;
  latestApprovalState: ApprovalState;
  /** Highest version number with an approved response, if any. */
  latestApprovedVersionNo: number | null;
};

const VERSION_COLUMNS =
  "id, engagement_id, element_id, version_no, client_snapshot, client_visible_at_publication, change_summary, published_by, published_at, methodology_version";

/** The whole working architecture of one engagement, joined in memory. */
export const loadArchitecture = cache(async (engagementId: string) => {
  const supabase = await createSupabaseServerClient();
  const by = <T extends { engagement_id: string }>(q: {
    eq: (c: "engagement_id", v: string) => PromiseLike<{ data: T[] | null; error: unknown }>;
  }) => q.eq("engagement_id", engagementId);

  const [
    elements,
    objects,
    recordDomains,
    assumptions,
    risks,
    constraints,
    dependencies,
    decisions,
    recommendations,
    versions,
    approvals,
    relationships,
    options,
  ] = await Promise.all([
    by<ElementRow>(supabase.from("architecture_elements").select("*")),
    by<ObjectRow>(supabase.from("architecture_objects").select("*")),
    by<Row<"intelligence_record_domains">>(
      supabase.from("intelligence_record_domains").select("*"),
    ),
    by<Row<"assumptions">>(supabase.from("assumptions").select("*")),
    by<Row<"risks">>(supabase.from("risks").select("*")),
    by<Row<"constraints">>(supabase.from("constraints").select("*")),
    by<Row<"dependencies">>(supabase.from("dependencies").select("*")),
    by<Row<"decisions">>(supabase.from("decisions").select("*")),
    by<Row<"recommendations">>(supabase.from("recommendations").select("*")),
    by<VersionRow>(supabase.from("element_versions").select(VERSION_COLUMNS)),
    by<ApprovalRow>(supabase.from("architecture_approvals").select("*")),
    by<RelationshipRow>(supabase.from("architecture_relationships").select("*")),
    by<Row<"decision_options">>(supabase.from("decision_options").select("*")),
  ]);
  for (const result of [
    elements,
    objects,
    recordDomains,
    assumptions,
    risks,
    constraints,
    dependencies,
    decisions,
    recommendations,
    versions,
    approvals,
    relationships,
    options,
  ]) {
    if (result.error) throw result.error;
  }

  const records = new Map<string, RecordDetails>();
  for (const row of assumptions.data ?? [])
    records.set(row.element_id, { kind: "assumption", row });
  for (const row of risks.data ?? []) records.set(row.element_id, { kind: "risk", row });
  for (const row of constraints.data ?? [])
    records.set(row.element_id, { kind: "constraint", row });
  for (const row of dependencies.data ?? [])
    records.set(row.element_id, { kind: "dependency", row });
  for (const row of decisions.data ?? []) records.set(row.element_id, { kind: "decision", row });
  for (const row of recommendations.data ?? [])
    records.set(row.element_id, { kind: "recommendation", row });

  const objectsById = new Map((objects.data ?? []).map((o) => [o.element_id, o]));
  const versionsByElement = new Map<string, VersionRow[]>();
  for (const v of (versions.data ?? []).sort((a, b) => b.version_no - a.version_no)) {
    const list = versionsByElement.get(v.element_id) ?? [];
    list.push(v);
    versionsByElement.set(v.element_id, list);
  }
  const approvalsByVersion = new Map(
    (approvals.data ?? [])
      .filter((a) => a.element_version_id)
      .map((a) => [a.element_version_id!, a]),
  );

  const loaded: LoadedElement[] = (elements.data ?? []).map((element) => {
    const object = objectsById.get(element.id) ?? null;
    const elementVersions = versionsByElement.get(element.id) ?? [];
    const latestVersion = elementVersions[0] ?? null;
    const latestApproval = latestVersion
      ? (approvalsByVersion.get(latestVersion.id) ?? null)
      : null;
    const approved = elementVersions.find(
      (v) => approvalsByVersion.get(v.id)?.response === "approved",
    );
    return {
      ...element,
      object,
      record: records.get(element.id) ?? null,
      domains: object
        ? [object.domain]
        : (recordDomains.data ?? [])
            .filter((d) => d.element_id === element.id)
            .map((d) => d.domain),
      versions: elementVersions,
      latestVersion,
      latestApproval,
      latestApprovalState: approvalState(
        latestApproval
          ? (latestApproval.response ?? "awaiting_response")
          : latestVersion
            ? "not_requested"
            : null,
      ),
      latestApprovedVersionNo: approved?.version_no ?? null,
    };
  });
  loaded.sort((a, b) =>
    (a.reference_code ?? "~").localeCompare(b.reference_code ?? "~", undefined, { numeric: true }),
  );

  return {
    elements: loaded,
    byId: new Map(loaded.map((e) => [e.id, e])),
    relationships: relationships.data ?? [],
    approvals: approvals.data ?? [],
    decisionOptions: (options.data ?? []).sort((a, b) => a.sort_order - b.sort_order),
  };
});

export type LoadedArchitecture = Awaited<ReturnType<typeof loadArchitecture>>;

export function objectsIn(architecture: LoadedArchitecture, domain: ArchitectureDomain) {
  return architecture.elements.filter((e) => e.object?.domain === domain);
}

export function recordsOf<K extends RecordKind>(architecture: LoadedArchitecture, kind: K) {
  return architecture.elements.filter(
    (e): e is LoadedElement & { record: Extract<RecordDetails, { kind: K }> } =>
      e.record?.kind === kind,
  );
}

/** The latest domain assessment per domain (internal: whether or not client-visible). */
export const getDomainStates = cache(async (engagementId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("architecture_domain_states", {
    p_engagement_id: engagementId,
  });
  if (error) throw error;
  return data ?? [];
});

/** Every domain assessment, newest first: the dated history of judgments. */
export async function listDomainAssessments(engagementId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("domain_assessments")
    .select("*, profiles:assessed_by(first_name, last_name, email)")
    .eq("engagement_id", engagementId)
    .order("assessed_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Calculated supporting information: object maturity counts per domain. */
export const getMaturityDistribution = cache(async (engagementId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("object_maturity_distribution", {
    p_engagement_id: engagementId,
  });
  if (error) throw error;
  return data ?? [];
});

/** Evidence sources of an engagement with the statements and elements citing them. */
export const listEvidence = cache(async (engagementId: string) => {
  const supabase = await createSupabaseServerClient();
  const [sources, statementLinks, elementLinks] = await Promise.all([
    supabase.from("evidence_sources").select("*").eq("engagement_id", engagementId).order("title"),
    supabase
      .from("statement_evidence_links")
      .select("*, architecture_statements(id, element_id, body, statement_kind)")
      .eq("engagement_id", engagementId),
    supabase.from("element_evidence_links").select("*").eq("engagement_id", engagementId),
  ]);
  if (sources.error) throw sources.error;
  if (statementLinks.error) throw statementLinks.error;
  if (elementLinks.error) throw elementLinks.error;
  return (sources.data ?? []).map((source) => ({
    ...source,
    statementLinks: (statementLinks.data ?? []).filter((l) => l.evidence_source_id === source.id),
    elementLinks: (elementLinks.data ?? []).filter((l) => l.evidence_source_id === source.id),
  }));
});

export type LoadedEvidence = Awaited<ReturnType<typeof listEvidence>>[number];

/** Everything the element page needs beyond the engagement-wide load. */
export async function getElementDetail(elementId: string) {
  const supabase = await createSupabaseServerClient();
  const [statements, lineage, activity, elementLinks] = await Promise.all([
    supabase
      .from("architecture_statements")
      .select(
        "*, statement_evidence_links(*, evidence_sources(id, title, source_type, client_visibility, reference, url))",
      )
      .eq("element_id", elementId)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("element_method_lineage")
      .select("*, method_assets(id, title, category, version)")
      .eq("element_id", elementId),
    supabase
      .from("activity_log")
      .select("id, action_type, created_at, metadata_json, entity_type, actor_user_id")
      .eq("entity_id", elementId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("element_evidence_links")
      .select("*, evidence_sources(id, title, source_type, client_visibility)")
      .eq("element_id", elementId),
  ]);
  if (statements.error) throw statements.error;
  if (lineage.error) throw lineage.error;
  if (elementLinks.error) throw elementLinks.error;
  return {
    statements: statements.data ?? [],
    lineage: lineage.data ?? [],
    // Activity is best-effort context; a failure here should not hide the element.
    activity: activity.error ? [] : (activity.data ?? []),
    elementEvidence: elementLinks.data ?? [],
  };
}

export type ElementStatement = Awaited<ReturnType<typeof getElementDetail>>["statements"][number];

/** The full internal snapshot of a published version (internal readers only). */
export async function getVersionSnapshot(versionId: string): Promise<InternalSnapshot | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("element_version_snapshot", {
    p_version_id: versionId,
  });
  if (error) throw error;
  return (data as InternalSnapshot | null) ?? null;
}

/** Exactly what publishing the working copy now would show a client. */
export async function previewClientSnapshot(elementId: string): Promise<ClientSnapshot | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("preview_client_snapshot", {
    p_element_id: elementId,
  });
  if (error) throw error;
  return (data as ClientSnapshot | null) ?? null;
}

/** TPLCo Method assets available for lineage (internal only by RLS). */
export async function listMethodAssets() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("method_assets")
    .select("id, title, category, version, status")
    .order("title");
  if (error) throw error;
  return data ?? [];
}

// Baselines ---------------------------------------------------------------------

export const listBaselines = cache(async (engagementId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("architecture_baselines")
    .select("*, architecture_baseline_items(element_id, element_version_id)")
    .eq("engagement_id", engagementId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
});

export async function getBaseline(baselineId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("architecture_baselines")
    .select(
      "*, architecture_baseline_items(element_id, element_version_id), architecture_baseline_assessments(domain, domain_assessment_id), architecture_baseline_relationships(relationship_id)",
    )
    .eq("id", baselineId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type BaselineComparisonRow =
  Database["public"]["Functions"]["compare_baselines"]["Returns"][number];

/** Differences from one frozen baseline to another, or to the current published architecture. */
export async function compareBaselines(fromId: string, toId: string | null) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("compare_baselines", {
    p_from_baseline_id: fromId,
    ...(toId ? { p_to_baseline_id: toId } : {}),
  });
  if (error) throw error;
  return data ?? [];
}

// Reviews across engagements ------------------------------------------------------

/**
 * Working copies in review, AI content awaiting review and approvals
 * awaiting the client, across every engagement the viewer can read.
 */
export async function getReviewQueue() {
  const supabase = await createSupabaseServerClient();
  const [inReview, aiElements, aiStatements, awaiting] = await Promise.all([
    supabase
      .from("architecture_elements")
      .select(
        "id, engagement_id, kind, reference_code, title, updated_at, engagements(slug, title)",
      )
      .eq("lifecycle", "in_review")
      .order("updated_at"),
    supabase
      .from("architecture_elements")
      .select("id, engagement_id, kind, reference_code, title, engagements(slug, title)")
      .eq("ai_review_state", "pending"),
    supabase
      .from("architecture_statements")
      .select("id, element_id, body, engagement_id, engagements(slug, title)")
      .eq("ai_review_state", "pending"),
    supabase
      .from("architecture_approvals")
      .select(
        "id, engagement_id, element_version_id, baseline_id, requested_at, request_note, engagements(slug, title)",
      )
      .is("response", null)
      .order("requested_at"),
  ]);
  for (const r of [inReview, aiElements, aiStatements, awaiting]) if (r.error) throw r.error;
  return {
    inReview: inReview.data ?? [],
    aiElements: aiElements.data ?? [],
    aiStatements: aiStatements.data ?? [],
    awaiting: awaiting.data ?? [],
  };
}

// Client read models --------------------------------------------------------------

export type ClientArchitectureRow = Omit<
  Database["public"]["Functions"]["client_architecture"]["Returns"][number],
  "client_snapshot"
> & { client_snapshot: ClientSnapshot };

/** The latest published, client-visible version of each element. */
export const getClientArchitecture = cache(
  async (engagementId: string): Promise<ClientArchitectureRow[]> => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("client_architecture", {
      p_engagement_id: engagementId,
    });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      ...row,
      client_snapshot: row.client_snapshot as unknown as ClientSnapshot,
    }));
  },
);

export const getClientRelationships = cache(async (engagementId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("client_architecture_relationships", {
    p_engagement_id: engagementId,
  });
  if (error) throw error;
  return data ?? [];
});

export type ClientDecisionOption = {
  id: string;
  title: string;
  description: string;
  tradeoffs: string;
  sort_order?: number;
};

export const getClientDecisions = cache(async (engagementId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("client_decisions", {
    p_engagement_id: engagementId,
  });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    options: (row.options as unknown as ClientDecisionOption[] | null) ?? [],
  }));
});

export async function getClientElementVersions(elementId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("client_element_versions", {
    p_element_id: elementId,
  });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    client_snapshot: row.client_snapshot as unknown as ClientSnapshot,
  }));
}

/** Approval requests a client can see that nobody has answered yet. */
export async function getClientPendingApprovals(engagementId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("architecture_approvals")
    .select("id, element_version_id, baseline_id, request_note, requested_at")
    .eq("engagement_id", engagementId)
    .is("response", null)
    .order("requested_at");
  if (error) throw error;
  return data ?? [];
}

/** Frozen baselines a client can see, with the versions they hold. */
export async function getClientBaselines(engagementId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("architecture_baselines")
    .select(
      "id, label, description, frozen_at, architecture_baseline_items(element_id, element_version_id)",
    )
    .eq("engagement_id", engagementId)
    .eq("status", "frozen")
    .order("frozen_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Client snapshots for specific versions (client policy: client-readable elements only). */
export async function getClientVersions(versionIds: string[]) {
  if (versionIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("element_versions")
    .select("id, element_id, version_no, published_at, change_summary, client_snapshot")
    .in("id", versionIds);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    client_snapshot: row.client_snapshot as unknown as ClientSnapshot,
  }));
}

export type { Json };

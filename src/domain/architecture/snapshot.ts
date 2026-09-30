import type { ApprovalSource } from "@/domain/finance/catalog";
import type {
  ArchitectureApprovalMethod,
  ArchitectureDomain,
  ElementKind,
  EvidenceSourceType,
  EvidenceStance,
  MaturityState,
  ProvenanceType,
  StatementKind,
} from "./catalog";

/**
 * The shape of published snapshots, as built by private.build_element_snapshot.
 * The client snapshot is a strict subset: no internal statements, internal
 * evidence, source references, IP classification, owners or AI reviewers.
 */

export type SnapshotEvidenceSource = {
  id: string;
  title: string;
  source_type: EvidenceSourceType;
  provenance: ProvenanceType;
  reference: string;
  url: string | null;
  publisher_author: string;
  source_date: string | null;
};

export type SnapshotCitation = {
  stance: EvidenceStance;
  locator: string;
  source: SnapshotEvidenceSource;
  note?: string;
};

export type SnapshotStatement = {
  id: string;
  statement_kind: StatementKind;
  body: string;
  provenance: ProvenanceType;
  evidence: SnapshotCitation[];
  client_visible?: boolean;
};

export type SnapshotOption = { id: string; title: string; description: string; tradeoffs: string };

/** Type-specific details: an object's domain and attributes, or a record's fields. */
export type SnapshotDetails = {
  domain?: ArchitectureDomain;
  object_type?: string;
  maturity?: MaturityState;
  maturity_rationale?: string;
  attributes?: Record<string, unknown>;
  // Records
  options?: SnapshotOption[];
  recommended_option_id?: string | null;
  recommendation_rationale?: string | null;
  chosen_option_id?: string | null;
  decision_status?: string;
  decision_source?: ApprovalSource | null;
  external_decision_method?: ArchitectureApprovalMethod | null;
  [key: string]: unknown;
};

export type ClientSnapshot = {
  element_id: string;
  kind: ElementKind;
  reference_code: string;
  title: string;
  summary: string;
  provenance: ProvenanceType;
  engagement_wide: boolean;
  details: SnapshotDetails;
  domains: ArchitectureDomain[];
  statements: SnapshotStatement[];
  evidence: SnapshotCitation[];
  evidence_source_ids: string[];
};

export type InternalSnapshot = ClientSnapshot & {
  source_reference: string;
  ip_classification: string;
  client_visibility: string;
  owner_user_id: string | null;
  methodology_version: string;
  ai_review_state: string;
};

/** Statements grouped by kind, in vocabulary order, for display. */
export function groupStatements<T extends { statement_kind: StatementKind }>(
  statements: readonly T[],
  order: readonly StatementKind[],
): { kind: StatementKind; statements: T[] }[] {
  return order
    .map((kind) => ({ kind, statements: statements.filter((s) => s.statement_kind === kind) }))
    .filter((group) => group.statements.length > 0);
}

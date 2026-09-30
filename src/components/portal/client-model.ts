import { buildGraph } from "@/domain/architecture/graph";
import type {
  ClientArchitectureRow,
  LoadedArchitecture,
  LoadedElement,
  RelationshipRow,
} from "@/domain/architecture/queries";

type ClientRelationship = {
  id: string;
  source_element_id: string;
  target_element_id: string;
  relationship_type: string;
  required_proficiency: string | null;
  description: string;
};

/**
 * The client's published architecture in the shape the domain views read.
 * Everything comes from client snapshots and client relationships: each
 * element is its latest published, client-visible version, so lifecycle and
 * visibility are fixed, and no working copy or internal attribute exists to
 * leak. Fields the views never read are left out.
 */
export function clientArchitectureModel(
  rows: readonly ClientArchitectureRow[],
  relationships: readonly ClientRelationship[],
) {
  const elements = rows.map((row) => {
    const details = row.client_snapshot.details ?? {};
    return {
      id: row.element_id,
      engagement_id: "",
      kind: row.kind,
      reference_code: row.reference_code,
      title: row.client_snapshot.title,
      summary: row.client_snapshot.summary,
      lifecycle: "published",
      client_visibility: "client",
      provenance: row.client_snapshot.provenance,
      engagement_wide: row.client_snapshot.engagement_wide,
      domains: row.client_snapshot.domains ?? [],
      object:
        row.kind === "object"
          ? {
              element_id: row.element_id,
              domain: details.domain ?? row.domain,
              object_type: details.object_type ?? row.object_type,
              maturity: details.maturity ?? null,
              maturity_rationale: details.maturity_rationale ?? "",
              attributes: details.attributes ?? {},
            }
          : null,
      record: null,
      versions: [],
      latestVersion: null,
      latestApproval: null,
      latestApprovalState: "not_requested",
      latestApprovedVersionNo: row.latest_approved_version_no,
    } as unknown as LoadedElement;
  });
  const visible = new Set(elements.map((e) => e.id));
  const edges = relationships
    .filter((r) => visible.has(r.source_element_id) && visible.has(r.target_element_id))
    .map((r) => ({ ...r, retired_at: null }) as unknown as RelationshipRow);
  const architecture = {
    elements,
    byId: new Map(elements.map((e) => [e.id, e])),
    relationships: edges,
    approvals: [],
    decisionOptions: [],
  } as unknown as LoadedArchitecture;
  return { architecture, graph: buildGraph(edges) };
}

import type {
  ArchitectureDomain,
  ClientVisibility,
  ConfidenceLevel,
  ElementLifecycle,
  ProvenanceType,
  RecommendationPriority,
  RecordKind,
} from "@/domain/architecture/catalog";
import { DOMAINS, PROVENANCE_TYPES } from "@/domain/architecture/catalog";
import { RECORD_KINDS } from "@/domain/architecture/vocabulary";
import { addDays } from "@/domain/finance/business-date";
import {
  ACTIVE_STATUSES,
  ATTENTION_LEVELS,
  isResolvableKind,
  isTerminalStatus,
  type EscalationLevel,
  type IntelligenceAttention,
  type TriageState,
} from "./catalog";

/**
 * The Project Intelligence register: filtering (proposal §5.2) and default
 * order (§5.3). The database returns every record the viewer may read
 * (public.intelligence_register); these pure functions decide what a
 * register view shows and in what order, so they are unit-tested.
 */

/** One row of public.intelligence_register, with its nullable columns typed as such. */
export type RegisterRow = {
  element_id: string;
  engagement_id: string;
  kind: RecordKind;
  reference_code: string;
  title: string;
  summary: string;
  lifecycle: ElementLifecycle;
  client_visibility: ClientVisibility;
  provenance: ProvenanceType;
  engagement_wide: boolean;
  owner_user_id: string | null;
  latest_version_id: string | null;
  created_at: string;
  updated_at: string;
  domains: ArchitectureDomain[];
  status: string | null;
  category: string | null;
  probability: number | null;
  impact: number | null;
  severity: number | null;
  value: number | null;
  feasibility: number | null;
  attractiveness: number | null;
  confidence: ConfidenceLevel | null;
  blocking: boolean | null;
  negotiable: boolean | null;
  needed_by: string | null;
  window_opens_on: string | null;
  window_closes_on: string | null;
  priority: RecommendationPriority | null;
  approval_state: string | null;
  attention: IntelligenceAttention;
  triage_state: TriageState;
  triaged_at: string | null;
  next_review_on: string | null;
  open_escalations: EscalationLevel[];
  open_client_actions: number;
};

export type StatusFilter = "active" | "resolved" | "all" | (string & {});
export type ReviewFilter = "overdue" | "soon" | null;

export type RegisterFilters = {
  kind: RecordKind | null;
  domain: ArchitectureDomain | null;
  /** Records bearing on this element through a Project Intelligence relationship. */
  element: string | null;
  engagementWide: boolean;
  status: StatusFilter;
  lifecycle: ElementLifecycle | null;
  visibility: ClientVisibility | null;
  provenance: ProvenanceType | null;
  attention: IntelligenceAttention | null;
  triage: TriageState | null;
  owner: string | null;
  category: string | null;
  review: ReviewFilter;
  escalated: boolean;
  openActions: boolean;
  signalled: boolean;
  q: string;
};

type Params = Record<string, string | string[] | undefined>;

const LIFECYCLES = ["draft", "in_review", "published", "superseded", "retired"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function one(params: Params, key: string): string {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function pick<T extends string>(value: string, allowed: readonly T[]): T | null {
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/** Filters from the URL. Anything unrecognized is ignored, never an error. */
export function parseRegisterFilters(params: Params): RegisterFilters {
  const flag = (key: string) => one(params, key) === "yes";
  const element = one(params, "element");
  const owner = one(params, "owner");
  const status = one(params, "status");
  return {
    kind: pick(one(params, "kind"), RECORD_KINDS),
    domain: pick(one(params, "domain"), DOMAINS),
    element: UUID.test(element) ? element.toLowerCase() : null,
    engagementWide: flag("wide"),
    status: status === "" ? "active" : /^[a-z_]{1,40}$/.test(status) ? status : "active",
    lifecycle: pick(one(params, "lifecycle"), LIFECYCLES),
    visibility: pick(one(params, "visibility"), ["internal", "client"] as const),
    provenance: pick(one(params, "provenance"), PROVENANCE_TYPES),
    attention: pick(one(params, "attention"), ATTENTION_LEVELS),
    triage: pick(one(params, "triage"), ["untriaged", "triaged"] as const),
    owner: UUID.test(owner) ? owner.toLowerCase() : null,
    category: /^[a-z_]{1,40}$/.test(one(params, "category")) ? one(params, "category") : null,
    review: pick(one(params, "review"), ["overdue", "soon"] as const),
    escalated: flag("escalated"),
    openActions: flag("actions"),
    signalled: flag("signals"),
    q: one(params, "q").slice(0, 200),
  };
}

/** The URL query for a set of filters (defaults left out), for links and forms. */
export function registerQuery(filters: Partial<RegisterFilters>): string {
  const entries: [string, string][] = [];
  const put = (key: string, value: string | null | undefined) => {
    if (value) entries.push([key, value]);
  };
  put("kind", filters.kind);
  put("domain", filters.domain);
  put("element", filters.element);
  if (filters.engagementWide) put("wide", "yes");
  if (filters.status && filters.status !== "active") put("status", filters.status);
  put("lifecycle", filters.lifecycle);
  put("visibility", filters.visibility);
  put("provenance", filters.provenance);
  put("attention", filters.attention);
  put("triage", filters.triage);
  put("owner", filters.owner);
  put("category", filters.category);
  put("review", filters.review);
  if (filters.escalated) put("escalated", "yes");
  if (filters.openActions) put("actions", "yes");
  if (filters.signalled) put("signals", "yes");
  put("q", filters.q);
  return new URLSearchParams(entries).toString();
}

/** Is the record still open (not resolved, decided or retired)? */
export function isActiveRecord(row: Pick<RegisterRow, "kind" | "status" | "lifecycle">): boolean {
  if (row.lifecycle === "retired" || row.lifecycle === "superseded") return false;
  if (row.kind === "decision") return row.status === "open" || row.status === "recommended";
  if (row.kind === "recommendation") return true;
  return !isTerminalStatus(row.kind, row.status);
}

export type RegisterContext = {
  /** Today in the business time zone (YYYY-MM-DD). */
  today: string;
  /** Element ids bearing on `filters.element`, when that filter is set. */
  bearingOnElement?: ReadonlySet<string>;
  /** Element ids with an undismissed signal. */
  signalled?: ReadonlySet<string>;
};

export function filterRegister(
  rows: readonly RegisterRow[],
  filters: RegisterFilters,
  context: RegisterContext,
): RegisterRow[] {
  const q = filters.q.toLowerCase();
  const soon = addDays(context.today, 14);
  return rows.filter((row) => {
    if (filters.kind && row.kind !== filters.kind) return false;
    if (filters.domain && !row.domains.includes(filters.domain)) return false;
    if (filters.element && !context.bearingOnElement?.has(row.element_id)) return false;
    if (filters.engagementWide && !row.engagement_wide) return false;
    switch (filters.status) {
      case "all":
        break;
      case "active":
        if (!isActiveRecord(row)) return false;
        break;
      case "resolved":
        if (isActiveRecord(row)) return false;
        break;
      default:
        if (row.status !== filters.status) return false;
    }
    if (filters.lifecycle && row.lifecycle !== filters.lifecycle) return false;
    if (filters.visibility && row.client_visibility !== filters.visibility) return false;
    if (filters.provenance && row.provenance !== filters.provenance) return false;
    if (filters.attention && row.attention !== filters.attention) return false;
    if (filters.triage && row.triage_state !== filters.triage) return false;
    if (filters.owner && row.owner_user_id !== filters.owner) return false;
    if (filters.category && row.category !== filters.category) return false;
    if (filters.review === "overdue" && !(row.next_review_on && row.next_review_on < context.today))
      return false;
    if (
      filters.review === "soon" &&
      !(row.next_review_on && row.next_review_on >= context.today && row.next_review_on <= soon)
    )
      return false;
    if (filters.escalated && row.open_escalations.length === 0) return false;
    if (filters.openActions && row.open_client_actions === 0) return false;
    if (filters.signalled && !context.signalled?.has(row.element_id)) return false;
    if (
      q &&
      !row.title.toLowerCase().includes(q) &&
      !row.reference_code.toLowerCase().includes(q) &&
      !row.summary.toLowerCase().includes(q)
    )
      return false;
    return true;
  });
}

// Default order ---------------------------------------------------------------------------

export type OrderContext = {
  today: string;
  /** Assumptions that underpin a published element. */
  underpinsPublished?: ReadonlySet<string>;
};

const ATTENTION_RANK: Record<IntelligenceAttention, number> = {
  critical: 0,
  high: 1,
  routine: 2,
  watch: 3,
};
const PRIORITY_RANK: Record<RecommendationPriority, number> = {
  critical: 0,
  important: 1,
  advisable: 2,
};
const CONFIDENCE_RANK: Record<ConfidenceLevel, number> = { low: 0, medium: 1, high: 2 };

/** Why each register is in the order it is (shown in the register header). */
export const REGISTER_ORDER_EXPLANATIONS: Record<RecordKind | "all", string> = {
  all: "Escalated first, then by attention, then by kind and reference.",
  risk: "Escalated first, then by attention, then by severity (probability × impact), then by next review date.",
  assumption:
    "Escalated first, then by attention, then those underpinning published architecture with low confidence and not yet validated.",
  constraint: "In force and non-negotiable first, then by attention.",
  dependency:
    "Blocking and broken or at risk first, then other blocking dependencies, then by attention, then by next review date.",
  decision:
    "Overdue decisions first, then open or recommended decisions by needed-by date, then the rest.",
  recommendation:
    "By priority (critical, important, advisable), then those awaiting the client's response.",
  opportunity: "Open windows closing soonest first, then by attractiveness (value × feasibility).",
};

type Key = number | string;

function compareKeys(a: readonly Key[], b: readonly Key[]): number {
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

/** Dates sort ascending with missing dates last. */
const dateKey = (date: string | null) => date ?? "9999-12-31";

/** Reference codes in natural order (RSK-2 before RSK-10). */
function referenceKey(code: string): string {
  return code.replace(/\d+/g, (n) => n.padStart(8, "0"));
}

function sortKey(row: RegisterRow, kind: RecordKind | null, context: OrderContext): Key[] {
  const escalated = row.open_escalations.length > 0 ? 0 : 1;
  const attention = ATTENTION_RANK[row.attention];
  const active = isActiveRecord(row) ? 0 : 1;
  switch (kind) {
    case "risk":
      return [active, escalated, attention, -(row.severity ?? 0), dateKey(row.next_review_on)];
    case "assumption": {
      const weak =
        context.underpinsPublished?.has(row.element_id) &&
        row.confidence === "low" &&
        isResolvableKind(row.kind) &&
        ACTIVE_STATUSES.assumption.includes(row.status ?? "")
          ? 0
          : 1;
      return [
        active,
        escalated,
        attention,
        weak,
        row.confidence ? CONFIDENCE_RANK[row.confidence] : 3,
      ];
    }
    case "constraint":
      return [active, row.status === "in_force" && row.negotiable === false ? 0 : 1, attention];
    case "dependency": {
      const blocking = row.blocking === true;
      const troubled = row.status === "broken" || row.status === "at_risk";
      return [
        active,
        blocking && troubled ? 0 : blocking ? 1 : 2,
        attention,
        dateKey(row.next_review_on),
      ];
    }
    case "decision": {
      const open = row.status === "open" || row.status === "recommended";
      const overdue = open && !!row.needed_by && row.needed_by < context.today;
      return [overdue ? 0 : open ? 1 : 2, open ? dateKey(row.needed_by) : "", attention];
    }
    case "recommendation":
      return [
        active,
        row.priority ? PRIORITY_RANK[row.priority] : 3,
        row.approval_state === "awaiting_response" ? 0 : 1,
        attention,
      ];
    case "opportunity": {
      const open = active === 0 && !!row.window_closes_on && row.window_closes_on >= context.today;
      return [
        active,
        open ? 0 : 1,
        open ? dateKey(row.window_closes_on) : "",
        -(row.attractiveness ?? 0),
      ];
    }
    default:
      return [active, escalated, attention, RECORD_KINDS.indexOf(row.kind)];
  }
}

/** The register in its default order for `kind` (null: every kind together). */
export function orderRegister(
  rows: readonly RegisterRow[],
  kind: RecordKind | null,
  context: OrderContext,
): RegisterRow[] {
  const keyed = rows.map((row) => ({
    row,
    key: [...sortKey(row, kind, context), referenceKey(row.reference_code)],
  }));
  keyed.sort((a, b) => compareKeys(a.key, b.key));
  return keyed.map((k) => k.row);
}

/** Counts that need judgment, for the intelligence home. */
export function registerCounts(rows: readonly RegisterRow[], today: string) {
  const live = rows.filter((r) => r.lifecycle !== "retired" && r.lifecycle !== "superseded");
  return {
    untriaged: live.filter((r) => r.triage_state === "untriaged" && isActiveRecord(r)).length,
    escalated: live.filter((r) => r.open_escalations.length > 0).length,
    reviewsOverdue: live.filter(
      (r) => isActiveRecord(r) && !!r.next_review_on && r.next_review_on < today,
    ).length,
    critical: live.filter((r) => r.attention === "critical" && isActiveRecord(r)).length,
    byKind: Object.fromEntries(
      RECORD_KINDS.map((k) => [k, live.filter((r) => r.kind === k && isActiveRecord(r)).length]),
    ) as Record<RecordKind, number>,
  };
}

type RegisterEdge = {
  source_element_id: string;
  target_element_id: string;
  relationship_type: string;
  retired_at?: string | null;
};

/**
 * Records bearing on an element: every record related to it in either
 * direction, plus dependencies naming it as either end.
 */
export function recordsBearingOn(
  elementId: string,
  edges: readonly RegisterEdge[],
  recordIds: ReadonlySet<string>,
  dependencyEnds: readonly {
    element_id: string;
    from_element_id: string;
    to_element_id: string;
  }[] = [],
): Set<string> {
  const ids = new Set<string>();
  for (const e of edges) {
    if (e.retired_at) continue;
    if (e.source_element_id === elementId && recordIds.has(e.target_element_id))
      ids.add(e.target_element_id);
    if (e.target_element_id === elementId && recordIds.has(e.source_element_id))
      ids.add(e.source_element_id);
  }
  for (const d of dependencyEnds) {
    if (d.from_element_id === elementId || d.to_element_id === elementId) ids.add(d.element_id);
  }
  ids.delete(elementId);
  return ids;
}

/** Assumptions that underpin at least one published element. */
export function assumptionsUnderpinningPublished(
  edges: readonly RegisterEdge[],
  published: ReadonlySet<string>,
): Set<string> {
  const ids = new Set<string>();
  for (const e of edges) {
    if (!e.retired_at && e.relationship_type === "underpins" && published.has(e.target_element_id))
      ids.add(e.source_element_id);
  }
  return ids;
}

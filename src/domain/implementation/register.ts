import type { ImplementationRegisterRow } from "./queries";
import { isTerminalStatus, type ImplementationStatus } from "./catalog";
import type {
  EscalationLevel,
  IntelligenceAttention,
  TriageState,
} from "@/domain/intelligence/catalog";

/**
 * The Implementation register: filtering and default order. The database
 * returns every initiative the viewer may read (public.implementation_
 * register); these pure functions decide what a register view shows and in
 * what order, so they are unit-tested (Phase 5 proposal §18).
 */

export type StatusFilter = "active" | "resolved" | "all" | (string & {});

export type RegisterFilters = {
  category: string | null;
  status: StatusFilter;
  attention: IntelligenceAttention | null;
  triage: TriageState | null;
  escalated: boolean;
  signalled: boolean;
  q: string;
};

type Params = Record<string, string | string[] | undefined>;

function one(params: Params, key: string): string {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/** Filters from the URL. Anything unrecognized is ignored, never an error. */
export function parseRegisterFilters(params: Params): RegisterFilters {
  const flag = (key: string) => one(params, key) === "yes";
  const status = one(params, "status");
  const attention = one(params, "attention");
  const triage = one(params, "triage");
  return {
    category: /^[a-z_]{1,40}$/.test(one(params, "category")) ? one(params, "category") : null,
    status: status === "" ? "active" : /^[a-z_]{1,40}$/.test(status) ? status : "active",
    attention: (["critical", "high", "routine", "watch"] as const).includes(
      attention as IntelligenceAttention,
    )
      ? (attention as IntelligenceAttention)
      : null,
    triage: triage === "untriaged" || triage === "triaged" ? triage : null,
    escalated: flag("escalated"),
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
  put("category", filters.category);
  if (filters.status && filters.status !== "active") put("status", filters.status);
  put("attention", filters.attention);
  put("triage", filters.triage);
  if (filters.escalated) put("escalated", "yes");
  if (filters.signalled) put("signals", "yes");
  put("q", filters.q);
  return new URLSearchParams(entries).toString();
}

/** Is the initiative still open (not validated or abandoned)? */
export function isActiveInitiative(
  row: Pick<ImplementationRegisterRow, "implementation_status">,
): boolean {
  return !isTerminalStatus(row.implementation_status as ImplementationStatus);
}

export type RegisterContext = {
  /** Today (YYYY-MM-DD), for the past-target ordering. */
  today: string;
  /** Element ids with an undismissed implementation_past_target signal. */
  signalled?: ReadonlySet<string>;
};

export function filterRegister(
  rows: readonly ImplementationRegisterRow[],
  filters: RegisterFilters,
  context: RegisterContext,
): ImplementationRegisterRow[] {
  const q = filters.q.toLowerCase();
  return rows.filter((row) => {
    if (filters.category && row.category !== filters.category) return false;
    switch (filters.status) {
      case "all":
        break;
      case "active":
        if (!isActiveInitiative(row)) return false;
        break;
      case "resolved":
        if (isActiveInitiative(row)) return false;
        break;
      default:
        if (row.implementation_status !== filters.status) return false;
    }
    if (filters.attention && row.attention !== filters.attention) return false;
    if (filters.triage && row.triage_state !== filters.triage) return false;
    if (filters.escalated && (row.open_escalations as EscalationLevel[]).length === 0) return false;
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

// Default order --------------------------------------------------------------------------

const ATTENTION_RANK: Record<IntelligenceAttention, number> = {
  critical: 0,
  high: 1,
  routine: 2,
  watch: 3,
};

/** Why the register is in the order it is, shown in the register header. */
export const REGISTER_ORDER_EXPLANATION =
  "Escalated first, then by attention, then initiatives past their target operational date, then by reference.";

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

/** Reference codes in natural order (IMP-2 before IMP-10). */
function referenceKey(code: string): string {
  return code.replace(/\d+/g, (n) => n.padStart(8, "0"));
}

function sortKey(row: ImplementationRegisterRow, context: RegisterContext): Key[] {
  const escalated = (row.open_escalations as EscalationLevel[]).length > 0 ? 0 : 1;
  const attention = ATTENTION_RANK[row.attention as IntelligenceAttention];
  const active = isActiveInitiative(row) ? 0 : 1;
  const pastTarget =
    active === 0 && !!row.target_operational_on && row.target_operational_on < context.today
      ? 0
      : 1;
  return [active, escalated, attention, pastTarget];
}

/** The register in its default order (§18). */
export function orderRegister(
  rows: readonly ImplementationRegisterRow[],
  context: RegisterContext,
): ImplementationRegisterRow[] {
  const keyed = rows.map((row) => ({
    row,
    key: [...sortKey(row, context), referenceKey(row.reference_code)],
  }));
  keyed.sort((a, b) => compareKeys(a.key, b.key));
  return keyed.map((k) => k.row);
}

/** Counts that need judgment, for the implementation home. */
export function registerCounts(rows: readonly ImplementationRegisterRow[]) {
  return {
    untriaged: rows.filter((r) => r.triage_state === "untriaged" && isActiveInitiative(r)).length,
    escalated: rows.filter((r) => (r.open_escalations as EscalationLevel[]).length > 0).length,
    critical: rows.filter((r) => r.attention === "critical" && isActiveInitiative(r)).length,
    active: rows.filter((r) => isActiveInitiative(r)).length,
    validated: rows.filter((r) => r.implementation_status === "validated").length,
  };
}

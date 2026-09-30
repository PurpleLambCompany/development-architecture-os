import { describe, expect, it } from "vitest";
import {
  assumptionsUnderpinningPublished,
  recordsBearingOn,
  filterRegister,
  isActiveRecord,
  orderRegister,
  parseRegisterFilters,
  registerCounts,
  registerQuery,
  type RegisterRow,
} from "./register";

const today = "2026-10-01";

let n = 0;
function row(overrides: Partial<RegisterRow>): RegisterRow {
  n += 1;
  return {
    element_id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    engagement_id: "e0000000-0000-4000-8000-000000000001",
    kind: "risk",
    reference_code: `RSK-${String(n).padStart(3, "0")}`,
    title: `Record ${n}`,
    summary: "",
    lifecycle: "draft",
    client_visibility: "internal",
    provenance: "architect_judgment",
    engagement_wide: false,
    owner_user_id: null,
    latest_version_id: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    domains: [],
    status: "open",
    category: "other",
    probability: null,
    impact: null,
    severity: null,
    value: null,
    feasibility: null,
    attractiveness: null,
    confidence: null,
    blocking: null,
    negotiable: null,
    needed_by: null,
    window_opens_on: null,
    window_closes_on: null,
    priority: null,
    approval_state: null,
    attention: "routine",
    triage_state: "triaged",
    triaged_at: null,
    next_review_on: null,
    open_escalations: [],
    open_client_actions: 0,
    ...overrides,
  };
}

const codes = (rows: RegisterRow[]) => rows.map((r) => r.reference_code);

describe("parseRegisterFilters", () => {
  it("defaults to active records of every kind", () => {
    const f = parseRegisterFilters({});
    expect(f.kind).toBeNull();
    expect(f.status).toBe("active");
    expect(f.escalated).toBe(false);
  });

  it("reads known values and ignores anything else", () => {
    const f = parseRegisterFilters({
      kind: "opportunity",
      domain: "capability",
      attention: "critical",
      triage: "nonsense",
      review: "overdue",
      escalated: "yes",
      actions: "no",
      element: "not-a-uuid",
      owner: "10000000-0000-4000-8000-000000000003",
      category: "Robert'); drop",
      status: ["resolved", "all"],
      q: "  capital ",
    });
    expect(f).toMatchObject({
      kind: "opportunity",
      domain: "capability",
      attention: "critical",
      triage: null,
      review: "overdue",
      escalated: true,
      openActions: false,
      element: null,
      owner: "10000000-0000-4000-8000-000000000003",
      category: null,
      status: "resolved",
      q: "capital",
    });
    expect(parseRegisterFilters({ kind: "object" }).kind).toBeNull();
  });

  it("round-trips through the URL query", () => {
    const f = parseRegisterFilters({ kind: "risk", status: "all", escalated: "yes", q: "a b" });
    expect(registerQuery(f)).toBe("kind=risk&status=all&escalated=yes&q=a+b");
    expect(parseRegisterFilters(Object.fromEntries(new URLSearchParams(registerQuery(f))))).toEqual(
      f,
    );
    expect(registerQuery(parseRegisterFilters({}))).toBe("");
  });
});

describe("isActiveRecord", () => {
  it("treats terminal statuses, settled decisions and retirement as closed", () => {
    expect(isActiveRecord({ kind: "risk", status: "mitigating", lifecycle: "published" })).toBe(
      true,
    );
    expect(isActiveRecord({ kind: "risk", status: "materialized", lifecycle: "published" })).toBe(
      false,
    );
    expect(isActiveRecord({ kind: "decision", status: "recommended", lifecycle: "draft" })).toBe(
      true,
    );
    expect(isActiveRecord({ kind: "decision", status: "decided", lifecycle: "draft" })).toBe(false);
    expect(isActiveRecord({ kind: "recommendation", status: null, lifecycle: "draft" })).toBe(true);
    expect(
      isActiveRecord({ kind: "assumption", status: "unvalidated", lifecycle: "retired" }),
    ).toBe(false);
  });
});

describe("filterRegister", () => {
  const rows = [
    row({ reference_code: "RSK-001", domains: ["capability"], attention: "critical" }),
    row({ reference_code: "RSK-002", status: "closed" }),
    row({
      reference_code: "OPP-001",
      kind: "opportunity",
      status: "evaluating",
      next_review_on: "2026-09-28",
      open_escalations: ["principal_architect"],
    }),
    row({
      reference_code: "ASM-001",
      kind: "assumption",
      status: "unvalidated",
      next_review_on: "2026-10-10",
      open_client_actions: 2,
      triage_state: "untriaged",
      title: "Universities commit land",
    }),
    row({
      reference_code: "CNS-001",
      kind: "constraint",
      status: "in_force",
      engagement_wide: true,
    }),
  ];
  const run = (params: Record<string, string>, context: object = {}) =>
    codes(filterRegister(rows, parseRegisterFilters(params), { today, ...context }));

  it("shows active records by default, resolved ones on request", () => {
    expect(run({})).toEqual(["RSK-001", "OPP-001", "ASM-001", "CNS-001"]);
    expect(run({ status: "resolved" })).toEqual(["RSK-002"]);
    expect(run({ status: "all" })).toHaveLength(5);
    expect(run({ status: "closed" })).toEqual(["RSK-002"]);
  });

  it("filters by kind, domain, scope, attention and triage", () => {
    expect(run({ kind: "risk" })).toEqual(["RSK-001"]);
    expect(run({ domain: "capability" })).toEqual(["RSK-001"]);
    expect(run({ wide: "yes" })).toEqual(["CNS-001"]);
    expect(run({ attention: "critical" })).toEqual(["RSK-001"]);
    expect(run({ triage: "untriaged" })).toEqual(["ASM-001"]);
  });

  it("filters by review due, escalation, open requests and text", () => {
    expect(run({ review: "overdue" })).toEqual(["OPP-001"]);
    expect(run({ review: "soon" })).toEqual(["ASM-001"]);
    expect(run({ escalated: "yes" })).toEqual(["OPP-001"]);
    expect(run({ actions: "yes" })).toEqual(["ASM-001"]);
    expect(run({ q: "universities" })).toEqual(["ASM-001"]);
    expect(run({ q: "opp-001" })).toEqual(["OPP-001"]);
  });

  it("filters by the element a record bears on, and by open signals", () => {
    const target = "b3000000-0000-4000-8000-000000000201";
    expect(run({ element: target }, { bearingOnElement: new Set([rows[3]!.element_id]) })).toEqual([
      "ASM-001",
    ]);
    expect(run({ element: target })).toEqual([]);
    expect(run({ signals: "yes" }, { signalled: new Set([rows[0]!.element_id]) })).toEqual([
      "RSK-001",
    ]);
  });
});

describe("orderRegister", () => {
  it("orders risks: escalated, attention, severity, next review", () => {
    const rows = [
      row({ reference_code: "RSK-001", severity: 20 }),
      row({ reference_code: "RSK-002", severity: 6, open_escalations: ["principal_architect"] }),
      row({ reference_code: "RSK-003", severity: 4, attention: "critical" }),
      row({ reference_code: "RSK-004", severity: 20, next_review_on: "2026-10-05" }),
      row({ reference_code: "RSK-005", severity: 25, status: "closed" }),
    ];
    expect(codes(orderRegister(rows, "risk", { today }))).toEqual([
      "RSK-002",
      "RSK-003",
      "RSK-004",
      "RSK-001",
      "RSK-005",
    ]);
  });

  it("orders assumptions with weak ones underpinning published architecture first", () => {
    const weak = row({
      reference_code: "ASM-002",
      kind: "assumption",
      status: "unvalidated",
      confidence: "low",
    });
    const rows = [
      row({
        reference_code: "ASM-001",
        kind: "assumption",
        status: "validating",
        confidence: "high",
      }),
      weak,
      row({
        reference_code: "ASM-003",
        kind: "assumption",
        status: "unvalidated",
        confidence: "low",
      }),
    ];
    expect(
      codes(
        orderRegister(rows, "assumption", {
          today,
          underpinsPublished: new Set([weak.element_id]),
        }),
      ),
    ).toEqual(["ASM-002", "ASM-003", "ASM-001"]);
  });

  it("orders constraints and dependencies by what binds or blocks", () => {
    expect(
      codes(
        orderRegister(
          [
            row({
              reference_code: "CNS-001",
              kind: "constraint",
              status: "in_force",
              negotiable: true,
            }),
            row({
              reference_code: "CNS-002",
              kind: "constraint",
              status: "in_force",
              negotiable: false,
            }),
          ],
          "constraint",
          { today },
        ),
      ),
    ).toEqual(["CNS-002", "CNS-001"]);
    expect(
      codes(
        orderRegister(
          [
            row({ reference_code: "DEP-001", kind: "dependency", status: "open", blocking: false }),
            row({ reference_code: "DEP-002", kind: "dependency", status: "open", blocking: true }),
            row({
              reference_code: "DEP-003",
              kind: "dependency",
              status: "at_risk",
              blocking: true,
            }),
          ],
          "dependency",
          { today },
        ),
      ),
    ).toEqual(["DEP-003", "DEP-002", "DEP-001"]);
  });

  it("orders decisions overdue first, then by needed-by date", () => {
    const rows = [
      row({ reference_code: "DEC-001", kind: "decision", status: "open", needed_by: "2026-12-01" }),
      row({
        reference_code: "DEC-002",
        kind: "decision",
        status: "decided",
        needed_by: "2026-01-01",
      }),
      row({
        reference_code: "DEC-003",
        kind: "decision",
        status: "recommended",
        needed_by: "2026-09-01",
      }),
      row({ reference_code: "DEC-004", kind: "decision", status: "open", needed_by: "2026-10-15" }),
      row({ reference_code: "DEC-005", kind: "decision", status: "open", needed_by: null }),
    ];
    expect(codes(orderRegister(rows, "decision", { today }))).toEqual([
      "DEC-003",
      "DEC-004",
      "DEC-001",
      "DEC-005",
      "DEC-002",
    ]);
  });

  it("orders recommendations by priority, then those awaiting the client", () => {
    const rows = [
      row({
        reference_code: "REC-001",
        kind: "recommendation",
        status: null,
        priority: "advisable",
      }),
      row({
        reference_code: "REC-002",
        kind: "recommendation",
        status: null,
        priority: "important",
      }),
      row({
        reference_code: "REC-003",
        kind: "recommendation",
        status: null,
        priority: "important",
        approval_state: "awaiting_response",
      }),
    ];
    expect(codes(orderRegister(rows, "recommendation", { today }))).toEqual([
      "REC-003",
      "REC-002",
      "REC-001",
    ]);
  });

  it("orders opportunities by the window closing soonest, then attractiveness", () => {
    const rows = [
      row({
        reference_code: "OPP-001",
        kind: "opportunity",
        status: "evaluating",
        attractiveness: 25,
      }),
      row({
        reference_code: "OPP-002",
        kind: "opportunity",
        status: "evaluating",
        window_closes_on: "2026-11-01",
        attractiveness: 4,
      }),
      row({
        reference_code: "OPP-003",
        kind: "opportunity",
        status: "identified",
        window_closes_on: "2026-10-10",
        attractiveness: 2,
      }),
      row({
        reference_code: "OPP-004",
        kind: "opportunity",
        status: "identified",
        window_closes_on: "2026-09-01",
        attractiveness: 16,
      }),
      row({
        reference_code: "OPP-005",
        kind: "opportunity",
        status: "realized",
        attractiveness: 25,
      }),
    ];
    expect(codes(orderRegister(rows, "opportunity", { today }))).toEqual([
      "OPP-003",
      "OPP-002",
      "OPP-001",
      "OPP-004",
      "OPP-005",
    ]);
  });

  it("breaks ties by reference code in natural order", () => {
    const rows = [row({ reference_code: "RSK-010" }), row({ reference_code: "RSK-002" })];
    expect(codes(orderRegister(rows, "risk", { today }))).toEqual(["RSK-002", "RSK-010"]);
  });
});

describe("registerCounts", () => {
  it("counts what needs judgment among active records", () => {
    const counts = registerCounts(
      [
        row({ triage_state: "untriaged" }),
        row({ triage_state: "untriaged", status: "closed" }),
        row({ next_review_on: "2026-09-01", attention: "critical" }),
        row({ open_escalations: ["client_executive"], lifecycle: "retired" }),
        row({ kind: "opportunity", status: "pursuing" }),
      ],
      today,
    );
    expect(counts).toMatchObject({ untriaged: 1, escalated: 0, reviewsOverdue: 1, critical: 1 });
    expect(counts.byKind.risk).toBe(2);
    expect(counts.byKind.opportunity).toBe(1);
  });
});

describe("recordsBearingOn", () => {
  const edge = (source: string, type: string, target: string, retired = false) => ({
    source_element_id: source,
    target_element_id: target,
    relationship_type: type,
    retired_at: retired ? "2026-09-01" : null,
  });
  it("finds records related either way and dependencies naming the element", () => {
    const edges = [
      edge("rsk", "threatens", "obj"),
      edge("obj", "pursues", "opp"),
      edge("other", "part_of", "obj"),
      edge("asm", "underpins", "obj", true),
    ];
    const records = new Set(["rsk", "opp", "asm", "dep"]);
    const deps = [{ element_id: "dep", from_element_id: "x", to_element_id: "obj" }];
    expect([...recordsBearingOn("obj", edges, records, deps)].sort()).toEqual([
      "dep",
      "opp",
      "rsk",
    ]);
  });
  it("finds assumptions underpinning published elements", () => {
    const edges = [edge("a1", "underpins", "pub"), edge("a2", "underpins", "draft")];
    expect([...assumptionsUnderpinningPublished(edges, new Set(["pub"]))]).toEqual(["a1"]);
  });
});

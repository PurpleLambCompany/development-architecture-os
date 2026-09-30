import { describe, expect, it } from "vitest";
import type { ImplementationRegisterRow } from "./queries";
import {
  filterRegister,
  isActiveInitiative,
  orderRegister,
  parseRegisterFilters,
  registerCounts,
  registerQuery,
} from "./register";

function row(overrides: Partial<ImplementationRegisterRow> = {}): ImplementationRegisterRow {
  return {
    element_id: "e1",
    engagement_id: "eng1",
    reference_code: "IMP-1",
    title: "Acquisition rollout",
    summary: "Standing up the acquisition process.",
    lifecycle: "draft",
    client_visibility: "internal",
    category: "process",
    implementation_status: "in_progress",
    target_operational_on: null,
    actual_operational_on: null,
    owner_member_id: null,
    attention: "routine",
    triage_state: "triaged",
    triaged_at: null,
    next_review_on: null,
    open_escalations: [],
    checkpoint_count: 0,
    achieved_checkpoint_count: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as ImplementationRegisterRow;
}

describe("isActiveInitiative", () => {
  it("treats only validated and abandoned as resolved", () => {
    expect(isActiveInitiative(row({ implementation_status: "not_started" }))).toBe(true);
    expect(isActiveInitiative(row({ implementation_status: "in_progress" }))).toBe(true);
    expect(isActiveInitiative(row({ implementation_status: "operational" }))).toBe(true);
    expect(isActiveInitiative(row({ implementation_status: "stalled" }))).toBe(true);
    expect(isActiveInitiative(row({ implementation_status: "validated" }))).toBe(false);
    expect(isActiveInitiative(row({ implementation_status: "abandoned" }))).toBe(false);
  });
});

describe("parseRegisterFilters / registerQuery", () => {
  it("defaults to the active status and ignores unknown values", () => {
    expect(parseRegisterFilters({}).status).toBe("active");
    expect(parseRegisterFilters({ attention: "invented" }).attention).toBeNull();
    expect(parseRegisterFilters({ triage: "invented" }).triage).toBeNull();
  });

  it("round-trips through the URL", () => {
    const filters = parseRegisterFilters({
      category: "system",
      status: "resolved",
      attention: "high",
      triage: "untriaged",
      escalated: "yes",
      signals: "yes",
      q: "vendor",
    });
    expect(filters).toEqual({
      category: "system",
      status: "resolved",
      attention: "high",
      triage: "untriaged",
      escalated: true,
      signalled: true,
      q: "vendor",
    });
    const query = registerQuery(filters);
    expect(parseRegisterFilters(Object.fromEntries(new URLSearchParams(query)))).toEqual(filters);
  });

  it("leaves the default active status out of the query", () => {
    expect(registerQuery({ status: "active" })).toBe("");
  });
});

describe("filterRegister", () => {
  const rows = [
    row({
      element_id: "a",
      reference_code: "IMP-1",
      category: "process",
      implementation_status: "in_progress",
    }),
    row({
      element_id: "b",
      reference_code: "IMP-2",
      category: "system",
      implementation_status: "validated",
    }),
    row({
      element_id: "c",
      reference_code: "IMP-3",
      category: "process",
      implementation_status: "stalled",
      attention: "critical",
      open_escalations: ["principal_architect"],
    }),
  ];
  const ctx = { today: "2026-06-01" };

  it("filters by category", () => {
    expect(
      filterRegister(rows, { ...blank(), category: "system" }, ctx).map((r) => r.element_id),
    ).toEqual(["b"]);
  });

  it("filters active vs resolved vs all", () => {
    expect(
      filterRegister(rows, { ...blank(), status: "active" }, ctx).map((r) => r.element_id),
    ).toEqual(["a", "c"]);
    expect(
      filterRegister(rows, { ...blank(), status: "resolved" }, ctx).map((r) => r.element_id),
    ).toEqual(["b"]);
    expect(filterRegister(rows, { ...blank(), status: "all" }, ctx)).toHaveLength(3);
  });

  it("filters by a specific status value", () => {
    expect(
      filterRegister(rows, { ...blank(), status: "stalled" }, ctx).map((r) => r.element_id),
    ).toEqual(["c"]);
  });

  it("filters by attention, triage, escalated and free text", () => {
    expect(
      filterRegister(rows, { ...blank(), attention: "critical" }, ctx).map((r) => r.element_id),
    ).toEqual(["c"]);
    expect(
      filterRegister(rows, { ...blank(), escalated: true }, ctx).map((r) => r.element_id),
    ).toEqual(["c"]);
    expect(filterRegister(rows, { ...blank(), q: "IMP-2" }, ctx).map((r) => r.element_id)).toEqual([
      "b",
    ]);
  });

  it("filters by signalled elements", () => {
    expect(
      filterRegister(
        rows,
        { ...blank(), signalled: true },
        { ...ctx, signalled: new Set(["c"]) },
      ).map((r) => r.element_id),
    ).toEqual(["c"]);
  });

  function blank() {
    return {
      category: null,
      status: "all",
      attention: null,
      triage: null,
      escalated: false,
      signalled: false,
      q: "",
    } as const;
  }
});

describe("orderRegister", () => {
  it("puts active before resolved, escalated before not, then attention, then past-target", () => {
    const rows = [
      row({ element_id: "resolved", reference_code: "IMP-9", implementation_status: "validated" }),
      row({ element_id: "routine", reference_code: "IMP-2", attention: "routine" }),
      row({
        element_id: "escalated",
        reference_code: "IMP-3",
        attention: "routine",
        open_escalations: ["principal_architect"],
      }),
      row({ element_id: "critical", reference_code: "IMP-1", attention: "critical" }),
      row({
        element_id: "past-target",
        reference_code: "IMP-4",
        attention: "routine",
        target_operational_on: "2026-01-01",
      }),
    ];
    const ordered = orderRegister(rows, { today: "2026-06-01" }).map((r) => r.element_id);
    expect(ordered).toEqual(["escalated", "critical", "past-target", "routine", "resolved"]);
  });

  it("orders reference codes naturally within a tier", () => {
    const rows = [
      row({ element_id: "ten", reference_code: "IMP-10" }),
      row({ element_id: "two", reference_code: "IMP-2" }),
    ];
    expect(orderRegister(rows, { today: "2026-06-01" }).map((r) => r.element_id)).toEqual([
      "two",
      "ten",
    ]);
  });
});

describe("registerCounts", () => {
  it("counts untriaged, escalated, critical, active and validated initiatives", () => {
    const rows = [
      row({ triage_state: "untriaged", implementation_status: "in_progress" }),
      row({ open_escalations: ["principal_architect"] }),
      row({ attention: "critical" }),
      row({ implementation_status: "validated" }),
      row({ implementation_status: "abandoned" }),
    ];
    expect(registerCounts(rows)).toEqual({
      untriaged: 1,
      escalated: 1,
      critical: 1,
      active: 3,
      validated: 1,
    });
  });
});

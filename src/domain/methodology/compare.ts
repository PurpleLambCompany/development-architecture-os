import type { Enums } from "@/types/database";

/**
 * Pure comparisons for the Method Library pages: how a DAM release differs
 * from the one before it, and how a Method Application's outputs compare
 * with what its Method version expected. Descriptive only: nothing here
 * scores a method or an application (Phase 6 §22.2).
 */

export type ReleaseMember = {
  assetId: string;
  assetTitle: string;
  versionId: string;
  versionLabel: string | null;
};

export type ReleaseChange =
  | { change: "added"; member: ReleaseMember }
  | { change: "removed"; member: ReleaseMember }
  | { change: "re_versioned"; member: ReleaseMember; priorVersionLabel: string | null }
  | { change: "unchanged"; member: ReleaseMember };

/** Members of `current` against `prior` (the release it follows), by asset. */
export function diffRelease(prior: ReleaseMember[], current: ReleaseMember[]): ReleaseChange[] {
  const before = new Map(prior.map((m) => [m.assetId, m]));
  const after = new Set(current.map((m) => m.assetId));
  const changes: ReleaseChange[] = current.map((member) => {
    const was = before.get(member.assetId);
    if (!was) return { change: "added", member };
    if (was.versionId !== member.versionId) {
      return { change: "re_versioned", member, priorVersionLabel: was.versionLabel };
    }
    return { change: "unchanged", member };
  });
  for (const member of prior) {
    if (!after.has(member.assetId)) changes.push({ change: "removed", member });
  }
  const order = { added: 0, re_versioned: 1, removed: 2, unchanged: 3 } as const;
  return changes.sort(
    (a, b) =>
      order[a.change] - order[b.change] || a.member.assetTitle.localeCompare(b.member.assetTitle),
  );
}

export type ExpectedOutput = {
  outputKind: Enums<"element_kind">;
  objectTypeKey: string | null;
  deliverableType: Enums<"deliverable_type"> | null;
};

export type ActualOutput = {
  role: Enums<"method_application_element_role">;
  kind: Enums<"element_kind"> | null;
  objectTypeKey: string | null;
  deliverableType: Enums<"deliverable_type"> | null;
};

export type OutputComparison = {
  expected: ExpectedOutput;
  produced: number;
}[];

function matches(expected: ExpectedOutput, actual: ActualOutput): boolean {
  if (actual.kind !== expected.outputKind) return false;
  if (expected.objectTypeKey && actual.objectTypeKey !== expected.objectTypeKey) return false;
  if (expected.deliverableType && actual.deliverableType !== expected.deliverableType) return false;
  return true;
}

/**
 * Each expected output with the number of linked elements the application
 * produced or revised that fit it, plus the produced elements no expectation
 * covers. Examined and informed links are inputs, not outputs.
 */
export function compareOutputs(
  expected: ExpectedOutput[],
  actual: ActualOutput[],
): { comparison: OutputComparison; unexpected: ActualOutput[] } {
  const outputs = actual.filter((a) => a.role === "produced" || a.role === "revised");
  const comparison = expected.map((e) => ({
    expected: e,
    produced: outputs.filter((a) => matches(e, a)).length,
  }));
  const unexpected = outputs.filter((a) => !expected.some((e) => matches(e, a)));
  return { comparison, unexpected };
}

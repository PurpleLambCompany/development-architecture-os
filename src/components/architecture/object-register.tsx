"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkPublishElements, bulkSubmitElementsForReview } from "@/domain/architecture/actions";
import type {
  ApprovalState,
  ElementKind,
  ElementLifecycle,
  MaturityState,
} from "@/domain/architecture/catalog";
import { Button } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/panel";
import {
  ApprovalTag,
  ElementLink,
  InternalMark,
  LifecycleTag,
  MaturityMark,
} from "@/components/architecture/badges";

export type ObjectRegisterRow = {
  id: string;
  kind: ElementKind;
  referenceCode: string | null;
  title: string;
  internal: boolean;
  typeLabel: string;
  lifecycle: ElementLifecycle;
  maturity: MaturityState;
  versionNo: number | null;
  approvalState: ApprovalState | null;
};

type BulkResultRow = {
  element_id: string;
  published?: boolean;
  submitted?: boolean;
  version_id?: string | null;
  error_code: string | null;
  error_message: string | null;
};

/** Rows this bulk action can act on: not yet published, or awaiting publish. */
const ELIGIBLE_LIFECYCLES: ElementLifecycle[] = ["draft", "in_review"];

/**
 * The domain register's "All objects" table (V1-A D8), with selection
 * checkboxes and a bulk action bar added so a Principal Architect can submit
 * or publish a realistic batch of elements -- the draft and in-review ones --
 * in one request instead of one round trip each. Selecting and the action
 * bar are offered only to a holder of edit_architecture / publish_architecture
 * (defense in depth: the database re-checks every one of those rules per
 * element regardless of what this page renders).
 */
export function ObjectRegisterTable({
  slug,
  rows,
  canEdit,
  canPublish,
}: {
  slug: string;
  rows: ObjectRegisterRow[];
  canEdit: boolean;
  canPublish: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{
    action: "submit" | "publish";
    rows: BulkResultRow[];
  } | null>(null);

  const eligibleIds = useMemo(
    () => rows.filter((r) => ELIGIBLE_LIFECYCLES.includes(r.lifecycle)).map((r) => r.id),
    [rows],
  );
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const offerBulk = canEdit || canPublish;
  const allEligibleSelected = eligibleIds.length > 0 && eligibleIds.every((id) => selected.has(id));
  const selectedCount = selected.size;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllEligible() {
    setSelected(allEligibleSelected ? new Set() : new Set(eligibleIds));
  }

  function runBulk(action: "submit" | "publish") {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const noun = ids.length === 1 ? "element" : "elements";
    const verb = action === "submit" ? "submit for review" : "publish";
    const clientNote =
      action === "publish"
        ? " Each becomes a new, immutable version, and client-visible ones become visible to the client at once."
        : "";
    if (
      !window.confirm(
        `${verb[0].toUpperCase()}${verb.slice(1)} ${ids.length} ${noun}?${clientNote}`,
      )
    ) {
      return;
    }
    setError(null);
    setResults(null);
    startTransition(async () => {
      const result =
        action === "submit"
          ? await bulkSubmitElementsForReview({ elementIds: ids })
          : await bulkPublishElements({ elementIds: ids, changeSummary: "" });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setResults({ action, rows: (result.data ?? []) as BulkResultRow[] });
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {offerBulk ? (
        <div className="flex flex-wrap items-center gap-3 rounded-sm border border-rule-strong bg-surface-muted px-4 py-3">
          <span className="text-sm text-ink-muted">
            {selectedCount === 0
              ? `${eligibleIds.length} publishable ${eligibleIds.length === 1 ? "element" : "elements"} in this view`
              : `${selectedCount} selected`}
          </span>
          {eligibleIds.length > 0 ? (
            <button
              type="button"
              onClick={toggleAllEligible}
              className="text-sm text-ink-muted hover:underline"
            >
              {allEligibleSelected
                ? "Clear selection"
                : `Select all ${eligibleIds.length} eligible`}
            </button>
          ) : null}
          <div className="ml-auto flex gap-2">
            {canEdit ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending || selectedCount === 0}
                onClick={() => runBulk("submit")}
              >
                {pending ? "Working…" : `Submit for review (${selectedCount})`}
              </Button>
            ) : null}
            {canPublish ? (
              <Button
                type="button"
                size="sm"
                disabled={pending || selectedCount === 0}
                onClick={() => runBulk("publish")}
              >
                {pending ? "Working…" : `Publish (${selectedCount})`}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      ) : null}

      {results ? (
        <div className="space-y-2 rounded-sm border border-rule-strong bg-surface-muted px-4 py-3">
          <p className="text-sm font-medium text-ink">
            {results.action === "publish" ? "Publication result" : "Submission result"}:{" "}
            {results.rows.filter((r) => r.published ?? r.submitted).length} of {results.rows.length}{" "}
            succeeded.
          </p>
          <ul className="space-y-1 text-sm">
            {results.rows.map((r) => {
              const row = byId.get(r.element_id);
              const ok = r.published ?? r.submitted;
              return (
                <li key={r.element_id} className={ok ? "text-ink-muted" : "text-negative"}>
                  <span className="font-mono text-xs">{row?.referenceCode ?? r.element_id}</span>{" "}
                  {row?.title ?? ""} — {ok ? "succeeded" : (r.error_message ?? "refused")}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState title="No objects yet" />
      ) : (
        <Table>
          <thead>
            <tr>
              {offerBulk ? (
                <Th className="w-8">
                  <input
                    type="checkbox"
                    aria-label="Select all eligible elements"
                    checked={allEligibleSelected}
                    disabled={eligibleIds.length === 0}
                    onChange={toggleAllEligible}
                  />
                </Th>
              ) : null}
              <Th>Object</Th>
              <Th>Type</Th>
              <Th>Lifecycle</Th>
              <Th>Maturity</Th>
              <Th>Approval</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const eligible = ELIGIBLE_LIFECYCLES.includes(o.lifecycle);
              return (
                <tr key={o.id}>
                  {offerBulk ? (
                    <Td>
                      {eligible ? (
                        <input
                          type="checkbox"
                          aria-label={`Select ${o.title}`}
                          checked={selected.has(o.id)}
                          onChange={() => toggle(o.id)}
                        />
                      ) : null}
                    </Td>
                  ) : null}
                  <Td>
                    <span className="flex flex-wrap items-center gap-2">
                      <ElementLink
                        slug={slug}
                        element={{
                          id: o.id,
                          kind: o.kind,
                          reference_code: o.referenceCode,
                          title: o.title,
                        }}
                      />
                      {o.internal ? <InternalMark /> : null}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap text-ink-muted">{o.typeLabel}</Td>
                  <Td>
                    <LifecycleTag lifecycle={o.lifecycle} />
                  </Td>
                  <Td className="whitespace-nowrap">
                    <MaturityMark maturity={o.maturity} />
                  </Td>
                  <Td>
                    {o.versionNo ? (
                      <span className="flex items-center gap-2 text-xs text-ink-muted">
                        v{o.versionNo}
                        {o.approvalState ? <ApprovalTag state={o.approvalState} /> : null}
                      </span>
                    ) : (
                      <span className="text-xs text-ink-subtle">Unpublished</span>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}

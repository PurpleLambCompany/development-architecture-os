import "server-only";
import { loadArchitecture } from "@/domain/architecture/queries";
import { RECORD_KINDS } from "@/domain/architecture/vocabulary";
import { DEFAULT_BUSINESS_TIME_ZONE, businessDate } from "@/domain/finance/business-date";
import { getRegister, getSignals } from "./queries";
import {
  assumptionsUnderpinningPublished,
  filterRegister,
  orderRegister,
  recordsBearingOn,
  registerCounts,
  type RegisterFilters,
} from "./register";

/** Today in the business time zone. */
export function businessToday(): string {
  return businessDate(new Date(), DEFAULT_BUSINESS_TIME_ZONE);
}

/**
 * One engagement's register as an internal reader sees it: filtered and in
 * its default order, with the counts and signals that frame it.
 */
export async function loadEngagementRegister(engagementId: string, filters: RegisterFilters) {
  const today = businessToday();
  const [rows, signals, architecture] = await Promise.all([
    getRegister(engagementId),
    getSignals(engagementId),
    loadArchitecture(engagementId),
  ]);
  const recordIds = new Set(
    architecture.elements
      .filter((e) => (RECORD_KINDS as readonly string[]).includes(e.kind))
      .map((e) => e.id),
  );
  const dependencyEnds = architecture.elements.flatMap((e) =>
    e.record?.kind === "dependency"
      ? [
          {
            element_id: e.id,
            from_element_id: e.record.row.from_element_id,
            to_element_id: e.record.row.to_element_id,
          },
        ]
      : [],
  );
  const published = new Set(
    architecture.elements.filter((e) => e.lifecycle === "published").map((e) => e.id),
  );
  const openSignals = signals.filter((s) => !s.dismissed);
  const signalCounts = new Map<string, number>();
  for (const s of openSignals) {
    if (s.element_id) signalCounts.set(s.element_id, (signalCounts.get(s.element_id) ?? 0) + 1);
  }
  const filtered = filterRegister(rows, filters, {
    today,
    bearingOnElement: filters.element
      ? recordsBearingOn(filters.element, architecture.relationships, recordIds, dependencyEnds)
      : undefined,
    signalled: new Set(signalCounts.keys()),
  });
  return {
    today,
    rows,
    shown: orderRegister(filtered, filters.kind, {
      today,
      underpinsPublished: assumptionsUnderpinningPublished(architecture.relationships, published),
    }),
    counts: registerCounts(rows, today),
    signals: openSignals,
    signalCounts,
    architecture,
    recordIds,
    dependencyEnds,
  };
}

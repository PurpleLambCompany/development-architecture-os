import type { InferenceKind, Subject } from "../types";

/**
 * Drawer subjects (7B.2 proposal §6.3, ADR-0067). Each subject of the
 * intelligence drawer maps to exactly one of the five existing inference
 * kinds and 7B.1 subjects: no new kind and no new subject. The drawer state
 * lives in the URL (subject and action only, never inference text), so a
 * drawer can be linked, reloaded and shared.
 */

export type DrawerSubject =
  | { drawer: "edge"; elementId: string; ruleKey: string; fingerprint: string }
  | { drawer: "revision"; elementId: string; versionId: string }
  | { drawer: "trace"; elementId: string }
  | { drawer: "pair"; elementId: string; secondElementId: string }
  | {
      drawer: "evidence";
      elementId: string;
      linkId: string;
      linkType: "statement_link" | "element_link";
    }
  | { drawer: "review"; elementId: string }
  | { drawer: "initiative"; elementId: string };

export type DrawerKind = DrawerSubject["drawer"];

/** The interface verb for each kind (IX-2, IX-3, IX-11). "Read" is never used. */
export const ACTION_LABELS: Record<InferenceKind, string> = {
  explanation: "Explain significance",
  tension: "Examine tension",
  evidence_bearing: "Examine bearing",
  realization_reading: "Compare with intent",
  review_brief: "Prepare",
};

/** The drawer's question line, by subject. */
export const DRAWER_QUESTIONS: Record<DrawerKind, string> = {
  edge: "Why am I seeing this?",
  revision: "What changed in this revision",
  trace: "What changing this reaches",
  pair: "These two elements, side by side",
  evidence: "This evidence link",
  review: "Review dossier",
  initiative: "Realization facts",
};

export function kindFor(subject: DrawerSubject): InferenceKind {
  switch (subject.drawer) {
    case "edge":
    case "revision":
    case "trace":
      return "explanation";
    case "pair":
      return "tension";
    case "evidence":
      return "evidence_bearing";
    case "review":
      return "review_brief";
    case "initiative":
      return "realization_reading";
  }
}

/** The 7B.1 Gateway subject for a drawer subject. */
export function gatewaySubject(subject: DrawerSubject): Subject {
  switch (subject.drawer) {
    case "edge":
      return {
        type: "edge_item",
        elementId: subject.elementId,
        ruleKey: subject.ruleKey,
        fingerprint: subject.fingerprint,
      };
    case "revision":
      return { type: "revision", elementId: subject.elementId, versionId: subject.versionId };
    case "trace":
      return { type: "impact_trace", elementId: subject.elementId };
    case "pair":
      return {
        type: "element_pair",
        elementId: subject.elementId,
        secondElementId: subject.secondElementId,
      };
    case "evidence":
      return {
        type: "evidence_link",
        elementId: subject.elementId,
        linkId: subject.linkId,
        linkType: subject.linkType,
      };
    case "review":
    case "initiative":
      return { type: "element", elementId: subject.elementId };
  }
}

/** The subject as the database read models take it (jsonb, 7B.1 subject columns). */
export function subjectJson(subject: DrawerSubject): Record<string, string> {
  const s = gatewaySubject(subject);
  switch (s.type) {
    case "edge_item":
      return {
        type: s.type,
        element_id: s.elementId,
        rule_key: s.ruleKey,
        fingerprint: s.fingerprint,
      };
    case "revision":
      return { type: s.type, element_id: s.elementId, version_id: s.versionId! };
    case "element_pair":
      return { type: s.type, element_id: s.elementId, second_element_id: s.secondElementId };
    case "evidence_link":
      return {
        type: s.type,
        element_id: s.elementId,
        link_id: s.linkId,
        link_type: s.linkType,
      };
    default:
      return { type: s.type, element_id: s.elementId };
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : null);
const text = (v: unknown, max: number) =>
  typeof v === "string" && v.length > 0 && v.length <= max ? v : null;

/** The drawer a page was opened with, from its query string, or null. */
export function drawerFromQuery(
  query: Record<string, string | string[] | undefined>,
): DrawerSubject | null {
  const el = uuid(query.el);
  if (!el) return null;
  switch (query.drawer) {
    case "edge": {
      const ruleKey = text(query.rule, 100);
      const fingerprint = text(query.fp, 1000);
      return ruleKey && fingerprint
        ? { drawer: "edge", elementId: el, ruleKey, fingerprint }
        : null;
    }
    case "revision": {
      const versionId = uuid(query.ver);
      return versionId ? { drawer: "revision", elementId: el, versionId } : null;
    }
    case "trace":
      return { drawer: "trace", elementId: el };
    case "pair": {
      const second = uuid(query.el2);
      return second && second !== el
        ? { drawer: "pair", elementId: el, secondElementId: second }
        : null;
    }
    case "evidence": {
      const linkId = uuid(query.link);
      const linkType =
        query.lt === "statement_link" || query.lt === "element_link" ? query.lt : null;
      return linkId && linkType ? { drawer: "evidence", elementId: el, linkId, linkType } : null;
    }
    case "review":
      return { drawer: "review", elementId: el };
    case "initiative":
      return { drawer: "initiative", elementId: el };
    default:
      return null;
  }
}

/** The query string that opens a drawer (subject and action only). */
export function drawerQuery(subject: DrawerSubject): string {
  const p = new URLSearchParams({ drawer: subject.drawer, el: subject.elementId });
  switch (subject.drawer) {
    case "edge":
      p.set("rule", subject.ruleKey);
      p.set("fp", subject.fingerprint);
      break;
    case "revision":
      p.set("ver", subject.versionId);
      break;
    case "pair":
      p.set("el2", subject.secondElementId);
      break;
    case "evidence":
      p.set("link", subject.linkId);
      p.set("lt", subject.linkType);
      break;
  }
  return p.toString();
}

/** Remove the drawer's parameters from a query, keeping the page's own. */
export function withoutDrawer(
  query: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (["drawer", "el", "el2", "rule", "fp", "ver", "link", "lt"].includes(k)) continue;
    if (typeof v === "string") p.set(k, v);
  }
  return p;
}

/** A kept inference's subject columns, as a drawer subject (for links from lists). */
export function drawerForInference(row: {
  inference_kind: string;
  subject_type: string;
  subject_element_id: string;
  second_element_id?: string | null;
  subject_version_id?: string | null;
  subject_rule_key?: string | null;
  subject_fingerprint?: string | null;
  link_id?: string | null;
  link_type?: string | null;
}): DrawerSubject | null {
  const el = row.subject_element_id;
  switch (row.subject_type) {
    case "edge_item":
      return row.subject_rule_key && row.subject_fingerprint
        ? {
            drawer: "edge",
            elementId: el,
            ruleKey: row.subject_rule_key,
            fingerprint: row.subject_fingerprint,
          }
        : null;
    case "revision":
      return row.subject_version_id
        ? { drawer: "revision", elementId: el, versionId: row.subject_version_id }
        : null;
    case "impact_trace":
      return { drawer: "trace", elementId: el };
    case "element_pair":
      return row.second_element_id
        ? { drawer: "pair", elementId: el, secondElementId: row.second_element_id }
        : null;
    case "evidence_link":
      return row.link_id && (row.link_type === "statement_link" || row.link_type === "element_link")
        ? { drawer: "evidence", elementId: el, linkId: row.link_id, linkType: row.link_type }
        : null;
    case "element":
      return row.inference_kind === "review_brief"
        ? { drawer: "review", elementId: el }
        : { drawer: "initiative", elementId: el };
    default:
      return null;
  }
}

/**
 * A page's drawer state: the drawer it was opened with (if any), the URL
 * that closes it (keeping the page's own parameters), and how to open one.
 */
export function pageDrawer(
  pagePath: string,
  query: Record<string, string | string[] | undefined>,
): {
  drawer: DrawerSubject | null;
  closeHref: string;
  open: (subject: DrawerSubject) => string;
} {
  const rest = withoutDrawer(query).toString();
  return {
    drawer: drawerFromQuery(query),
    closeHref: rest ? `${pagePath}?${rest}` : pagePath,
    open: (subject) => `${pagePath}?${drawerQuery(subject)}`,
  };
}

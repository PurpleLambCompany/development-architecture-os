import type { FieldSpec } from "@/components/ui/action-form";
import {
  DOMAINS,
  DOMAIN_SHORT_LABELS,
  EVIDENCE_STANCES,
  EVIDENCE_STANCE_LABELS,
} from "@/domain/architecture/catalog";
import {
  ACTIVE_STATUSES,
  ATTENTION,
  ATTENTION_LEVELS,
  CLIENT_ACTION_KIND_LABELS,
  ESCALATION_LEVEL_LABELS,
  RESOLUTION_VERBS,
  SENDABLE_CLIENT_ACTION_KINDS,
  TERMINAL_STATUSES,
  recordStatus,
  type ResolvableKind,
} from "@/domain/intelligence/catalog";

/**
 * Form field specifications for Project Intelligence actions. Only choices
 * the database can accept are offered; it still checks every one.
 */

type Option = { value: string; label: string };

export const triageFields: FieldSpec[] = [
  {
    name: "attention",
    label: "Attention",
    type: "select",
    options: ATTENTION_LEVELS.map((a) => ({
      value: a,
      label: `${ATTENTION[a].label}: ${ATTENTION[a].description}`,
    })),
  },
  { name: "nextReviewOn", label: "Next review", type: "date" },
  {
    name: "note",
    label: "Note",
    type: "textarea",
    hint: "Required for critical attention. Recorded in the history.",
  },
];

export function resolveFields(kind: ResolvableKind, canPublish: boolean): FieldSpec[] {
  const statuses = TERMINAL_STATUSES[kind].filter(
    // Accepting a risk is a publishing judgment (checked in the database).
    (s) => canPublish || !(kind === "risk" && s === "accepted"),
  );
  const fields: FieldSpec[] = [
    {
      name: "status",
      label: "Resolve as",
      type: "select",
      options: statuses.map((s) => ({
        value: s,
        label: `${RESOLUTION_VERBS[s] ?? s} (${recordStatus(kind, s)?.label ?? s})`,
      })),
    },
    {
      name: "rationale",
      label: "Rationale",
      type: "textarea",
      hint: "Why the record is resolved. Cite evidence on its statements as usual.",
    },
  ];
  if (canPublish) {
    fields.push(
      {
        name: "publish",
        label: "Publish the resolution",
        type: "select",
        options: [
          { value: "no", label: "No, publish later" },
          { value: "yes", label: "Yes, publish a new version now" },
        ],
        hint: "Clients see the change only once a new version is published.",
      },
      { name: "changeSummary", label: "Change summary", hint: "Optional; used when publishing." },
    );
  }
  return fields;
}

export function reopenFields(kind: ResolvableKind): FieldSpec[] {
  return [
    {
      name: "status",
      label: "Reopen as",
      type: "select",
      options: ACTIVE_STATUSES[kind].map((s) => ({
        value: s,
        label: recordStatus(kind, s)?.label ?? s,
      })),
    },
    { name: "rationale", label: "Rationale", type: "textarea" },
  ];
}

export function escalateFields(canPublish: boolean, executives: Option[]): FieldSpec[] {
  const levels =
    canPublish && executives.length > 0
      ? (["principal_architect", "client_executive"] as const)
      : (["principal_architect"] as const);
  const fields: FieldSpec[] = [
    {
      name: "level",
      label: "Escalate to",
      type: "select",
      options: levels.map((l) => ({ value: l, label: ESCALATION_LEVEL_LABELS[l] })),
    },
    { name: "reason", label: "Reason", type: "textarea" },
  ];
  if (levels.length > 1) {
    fields.push(
      {
        name: "addresseeMemberId",
        label: "Client executive",
        type: "select",
        options: [{ value: "", label: "Choose (client executive only)" }, ...executives],
        hint: "Sends an executive-attention request naming this record.",
      },
      { name: "dueOn", label: "Response due", type: "date" },
    );
  }
  return fields;
}

export function sendActionFields(addressees: Option[], subjects: Option[]): FieldSpec[] {
  return [
    {
      name: "kind",
      label: "Kind",
      type: "select",
      options: SENDABLE_CLIENT_ACTION_KINDS.map((k) => ({
        value: k,
        label: CLIENT_ACTION_KIND_LABELS[k],
      })),
    },
    {
      name: "addresseeMemberId",
      label: "To",
      type: "select",
      options: addressees,
      hint: "Client members who can respond. Area-limited members can be asked only about their areas.",
    },
    { name: "title", label: "Title", wide: true },
    { name: "request", label: "Request", type: "textarea" },
    { name: "dueOn", label: "Due", type: "date" },
    {
      name: "subjectIds",
      label: "About (published, client-visible)",
      type: "checkboxes",
      options: subjects,
      wide: true,
    },
  ];
}

export function reassignFields(members: Option[]): FieldSpec[] {
  return [
    { name: "memberId", label: "Reassign to", type: "select", options: members },
    { name: "note", label: "Note", type: "textarea" },
  ];
}

export const requiredNoteFields = (label: string, hint?: string): FieldSpec[] => [
  { name: "note", label, type: "textarea", hint },
];

export function recordAsEvidenceFields(statements: Option[]): FieldSpec[] {
  return [
    { name: "title", label: "Evidence title", hint: "Defaults to the request's code and title." },
    {
      name: "statementId",
      label: "Cite on statement",
      type: "select",
      options: [{ value: "", label: "Do not cite yet" }, ...statements],
    },
    {
      name: "stance",
      label: "Stance",
      type: "select",
      options: EVIDENCE_STANCES.map((s) => ({ value: s, label: EVIDENCE_STANCE_LABELS[s] })),
    },
  ];
}

export function handleContributionFields(statements: Option[]): FieldSpec[] {
  return [
    {
      name: "status",
      label: "Outcome",
      type: "select",
      options: [
        { value: "incorporated", label: "Incorporated into the architecture" },
        { value: "acknowledged", label: "Acknowledged" },
      ],
    },
    {
      name: "note",
      label: "Note to the contributor",
      type: "textarea",
      hint: "The contributor sees this note.",
    },
    {
      name: "recordAsEvidence",
      label: "Record as evidence",
      type: "select",
      options: [
        { value: "no", label: "No" },
        { value: "yes", label: "Yes (incorporated input only)" },
      ],
    },
    {
      name: "statementId",
      label: "Cite on statement",
      type: "select",
      options: [{ value: "", label: "Do not cite" }, ...statements],
    },
  ];
}

export function areaFields(elements: Option[]): FieldSpec[] {
  return [
    {
      name: "domain",
      label: "A domain",
      type: "select",
      options: [
        { value: "", label: "—" },
        ...DOMAINS.map((d) => ({ value: d, label: DOMAIN_SHORT_LABELS[d] })),
      ],
    },
    {
      name: "elementId",
      label: "Or an element and everything under it",
      type: "select",
      options: [{ value: "", label: "—" }, ...elements],
    },
  ];
}

export const dismissFields: FieldSpec[] = [
  { name: "reason", label: "Why it needs no action", type: "textarea" },
  {
    name: "expiresOn",
    label: "Show again on",
    type: "date",
    hint: "Optional. The signal also returns if its facts change.",
  },
];

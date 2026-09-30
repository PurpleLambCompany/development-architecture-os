import type { FieldSpec } from "@/components/ui/action-form";

/** Judgment choices (§15.1). Promote is its own flow: it creates a governed record first. */
export const judgmentFields: FieldSpec[] = [
  {
    name: "kind",
    label: "Judgment",
    type: "select",
    options: [
      { value: "investigating", label: "Investigating: I am examining this" },
      { value: "not_material", label: "Not material: this does not need action" },
      { value: "deferred", label: "Defer: not now, until a date" },
      { value: "disagree", label: "Disagree: the rule is wrong for this case" },
    ],
  },
  { name: "expiresOn", label: "Return on (for a deferral)", type: "date" },
  {
    name: "reason",
    label: "Reason",
    type: "textarea",
    hint: "Required except for Investigating. Recorded with your name; a later change to its facts brings the item back.",
  },
];

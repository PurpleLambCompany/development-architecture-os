import type { FieldSpec } from "@/components/ui/action-form";

/**
 * Judgment choices on an interpretation (IX-19): the Edge's closed set, in
 * words about the interpretation rather than a rule. Promote is its own flow.
 */
export const inferenceJudgmentFields: FieldSpec[] = [
  {
    name: "kind",
    label: "Judgment on the interpretation",
    type: "select",
    options: [
      { value: "investigating", label: "Investigating: I am examining this" },
      { value: "not_material", label: "Not material: this does not need action" },
      { value: "deferred", label: "Defer: not now, until a date" },
      { value: "disagree", label: "Disagree: the interpretation is wrong for this case" },
    ],
  },
  { name: "expiresOn", label: "Return on (for a deferral)", type: "date" },
  {
    name: "reason",
    label: "Reason",
    type: "textarea",
    hint: "Required except for Investigating. Recorded with your name. A change to the records it read ends the judgment.",
  },
];

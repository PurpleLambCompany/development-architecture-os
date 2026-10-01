import { describe, expect, it } from "vitest";
import { INFERENCE_KINDS } from "../types";
import {
  ACTION_LABELS,
  drawerForInference,
  drawerFromQuery,
  drawerQuery,
  gatewaySubject,
  kindFor,
  subjectJson,
  withoutDrawer,
  type DrawerSubject,
} from "./subjects";

const A = "b3000000-0000-4000-8000-000000000201";
const B = "b3000000-0000-4000-8000-000000000204";
const subjects: DrawerSubject[] = [
  { drawer: "edge", elementId: A, ruleKey: "upstream_revised", fingerprint: "x:y" },
  { drawer: "revision", elementId: A, versionId: B },
  { drawer: "trace", elementId: A },
  { drawer: "pair", elementId: A, secondElementId: B },
  { drawer: "evidence", elementId: A, linkId: B, linkType: "statement_link" },
  { drawer: "review", elementId: A },
  { drawer: "initiative", elementId: A },
];
const parse = (q: string) => drawerFromQuery(Object.fromEntries(new URLSearchParams(q)));

describe("drawer subjects", () => {
  it.each(subjects)("round-trips $drawer through the query string", (s) => {
    expect(parse(drawerQuery(s))).toEqual(s);
  });

  it("maps every drawer to one of the five kinds and back from a kept row", () => {
    for (const s of subjects) {
      expect(INFERENCE_KINDS).toContain(kindFor(s));
      const g = gatewaySubject(s);
      const json = subjectJson(s);
      expect(json.type).toBe(g.type);
      const row = {
        inference_kind: kindFor(s),
        subject_type: json.type!,
        subject_element_id: s.elementId,
        second_element_id: s.drawer === "pair" ? s.secondElementId : null,
        subject_version_id: s.drawer === "revision" ? s.versionId : null,
        subject_rule_key: s.drawer === "edge" ? s.ruleKey : null,
        subject_fingerprint: s.drawer === "edge" ? s.fingerprint : null,
        link_id: s.drawer === "evidence" ? s.linkId : null,
        link_type: s.drawer === "evidence" ? s.linkType : null,
      };
      expect(drawerForInference(row), s.drawer).toEqual(s);
    }
  });

  it("refuses malformed parameters rather than guessing", () => {
    expect(parse("drawer=trace&el=not-a-uuid")).toBeNull();
    expect(parse(`drawer=pair&el=${A}&el2=${A}`)).toBeNull();
    expect(parse(`drawer=evidence&el=${A}&link=${B}&lt=other`)).toBeNull();
    expect(parse(`drawer=revision&el=${A}`)).toBeNull();
    expect(parse(`drawer=edge&el=${A}&rule=r`)).toBeNull();
    expect(parse(`drawer=chat&el=${A}`)).toBeNull();
  });

  it("closes a drawer keeping the page's own parameters", () => {
    expect(withoutDrawer({ drawer: "trace", el: A, tab: "edge" }).toString()).toBe("tab=edge");
  });

  it("never uses the word Read for an action (IX-2)", () => {
    for (const label of Object.values(ACTION_LABELS)) expect(label).not.toMatch(/\bread\b/i);
  });
});

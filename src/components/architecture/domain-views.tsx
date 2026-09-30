import { Fragment, type ReactNode } from "react";
import {
  SKILL_PROFICIENCY_LABELS,
  type ArchitectureDomain,
  type SkillProficiency,
} from "@/domain/architecture/catalog";
import { buildGraph, buildTree, flattenTree, type Graph } from "@/domain/architecture/graph";
import { attributeValue } from "@/domain/architecture/object-types";
import type {
  LoadedArchitecture,
  LoadedElement,
  RelationshipRow,
} from "@/domain/architecture/queries";
import type { ObjectTypeKey } from "@/domain/architecture/rules";
import { EmptyState, Panel } from "@/components/ui/panel";
import { Table, Td, Th } from "@/components/ui/table";
import { ElementLink, InternalMark, LifecycleTag, MaturityMark } from "./badges";

/**
 * Views built for each domain (proposal §10): the Knowledge domain map, the
 * capability map and role-to-skill matrix, outcomes with their logic, and
 * the application structure, decision rights and measurement system. They
 * read the same elements and relationships; nothing here is a task list.
 */

type ViewProps = {
  slug: string;
  objects: LoadedElement[];
  architecture: LoadedArchitecture;
  graph: Graph<RelationshipRow>;
};

const ofType = (objects: LoadedElement[], type: ObjectTypeKey) =>
  objects.filter((o) => o.object?.object_type === type);
const attr = (element: LoadedElement, key: string) =>
  attributeValue(element.object!.object_type as ObjectTypeKey, element.object!.attributes, key);
const rawAttr = (element: LoadedElement, key: string) =>
  (element.object?.attributes as Record<string, unknown> | null)?.[key];
const bySequence = (a: LoadedElement, b: LoadedElement) =>
  Number(rawAttr(a, "sequence") ?? 99) - Number(rawAttr(b, "sequence") ?? 99);

export function DomainViews({ domain, ...props }: ViewProps & { domain: ArchitectureDomain }) {
  switch (domain) {
    case "knowledge":
      return <KnowledgeViews {...props} />;
    case "capability":
      return <CapabilityViews {...props} />;
    case "strategic_model":
      return <StrategicModelViews {...props} />;
    case "application":
      return <ApplicationViews {...props} />;
  }
}

export function viewGraph(architecture: LoadedArchitecture) {
  return buildGraph(architecture.relationships);
}

function Links({
  slug,
  architecture,
  ids,
}: {
  slug: string;
  architecture: LoadedArchitecture;
  ids: string[];
}) {
  const elements = ids.map((id) => architecture.byId.get(id)).filter(Boolean) as LoadedElement[];
  if (elements.length === 0) return <span className="text-ink-subtle">—</span>;
  return (
    <span className="flex flex-col gap-1">
      {elements.map((e) => (
        <ElementLink key={e.id} slug={slug} element={e} />
      ))}
    </span>
  );
}

function Title({ slug, element }: { slug: string; element: LoadedElement }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <ElementLink slug={slug} element={element} />
      {element.client_visibility === "internal" ? <InternalMark /> : null}
      {element.lifecycle !== "published" ? <LifecycleTag lifecycle={element.lifecycle} /> : null}
    </span>
  );
}

function Section({
  title,
  description,
  empty,
  children,
}: {
  title: string;
  description?: string;
  empty: boolean;
  children: ReactNode;
}) {
  return (
    <Panel title={title} description={description}>
      {empty ? <EmptyState title="None recorded yet" /> : children}
    </Panel>
  );
}

// Knowledge ------------------------------------------------------------------------

function KnowledgeViews({ slug, objects, architecture, graph }: ViewProps) {
  const mapItems = objects.filter((o) =>
    ["knowledge_area", "concept"].includes(o.object!.object_type),
  );
  const map = flattenTree(buildTree(mapItems, graph, ["part_of", "specializes"]));
  const questions = ofType(objects, "research_question");
  const gaps = ofType(objects, "knowledge_gap");
  const boundaries = ofType(objects, "system_boundary");
  const context = objects.filter((o) =>
    ["regulatory_factor", "competitive_factor", "stakeholder"].includes(o.object!.object_type),
  );
  const statusOrder = ["open", "answered", "set_aside"];

  return (
    <>
      <Section
        title="Domain map"
        description="Knowledge areas and the concepts within them. Indentation follows is part of and is a kind of."
        empty={map.length === 0}
      >
        <ul className="space-y-1.5">
          {map.map(({ item, depth }) => (
            <li key={item.id} style={{ paddingLeft: `${depth * 1.5}rem` }} className="text-sm">
              <span className="flex flex-wrap items-baseline gap-3">
                <Title slug={slug} element={item} />
                <span className="text-xs text-ink-subtle">
                  {item.object!.object_type === "knowledge_area" ? "Area" : "Concept"}
                  {attr(item, "criticality") ? ` · ${attr(item, "criticality")}` : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Research questions" empty={questions.length === 0}>
        <Table>
          <thead>
            <tr>
              <Th>Question</Th>
              <Th>Status</Th>
              <Th>Investigates</Th>
            </tr>
          </thead>
          <tbody>
            {[...questions]
              .sort(
                (a, b) =>
                  statusOrder.indexOf(String(rawAttr(a, "status") ?? "open")) -
                  statusOrder.indexOf(String(rawAttr(b, "status") ?? "open")),
              )
              .map((q) => (
                <tr key={q.id}>
                  <Td>
                    <Title slug={slug} element={q} />
                    {attr(q, "question") ? (
                      <p className="mt-1 text-xs text-ink-muted">{attr(q, "question")}</p>
                    ) : null}
                  </Td>
                  <Td className="whitespace-nowrap">{attr(q, "status") ?? "Open"}</Td>
                  <Td>
                    <Links
                      slug={slug}
                      architecture={architecture}
                      ids={graph.targets(q.id, "investigates").map((e) => e.target_element_id)}
                    />
                  </Td>
                </tr>
              ))}
          </tbody>
        </Table>
      </Section>

      <Section title="Knowledge gaps" empty={gaps.length === 0}>
        <Table>
          <thead>
            <tr>
              <Th>Gap</Th>
              <Th>Consequence if unresolved</Th>
              <Th>Gap in</Th>
            </tr>
          </thead>
          <tbody>
            {gaps.map((g) => (
              <tr key={g.id}>
                <Td>
                  <Title slug={slug} element={g} />
                </Td>
                <Td className="text-ink-muted">{attr(g, "consequence_if_unresolved") ?? "—"}</Td>
                <Td>
                  <Links
                    slug={slug}
                    architecture={architecture}
                    ids={graph.targets(g.id, "gap_in").map((e) => e.target_element_id)}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>

      <Section title="System boundary" empty={boundaries.length === 0}>
        {boundaries.map((b) => (
          <div key={b.id} className="space-y-3">
            <Title slug={slug} element={b} />
            <dl className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
              {(["inside", "outside", "interfaces"] as const).map((key) => (
                <div key={key}>
                  <dt className="text-xs tracking-wide text-ink-subtle uppercase">{key}</dt>
                  <dd className="mt-1 text-ink">{attr(b, key) ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </Section>

      <Section
        title="Context"
        description="Regulatory and competitive factors and stakeholders."
        empty={context.length === 0}
      >
        <Table>
          <thead>
            <tr>
              <Th>Factor</Th>
              <Th>Type</Th>
              <Th>Detail</Th>
            </tr>
          </thead>
          <tbody>
            {context.map((c) => (
              <tr key={c.id}>
                <Td>
                  <Title slug={slug} element={c} />
                </Td>
                <Td className="whitespace-nowrap text-ink-muted">
                  {c.object!.object_type === "regulatory_factor"
                    ? "Regulatory"
                    : c.object!.object_type === "competitive_factor"
                      ? "Competitive"
                      : "Stakeholder"}
                </Td>
                <Td className="text-ink-muted">
                  {(attr(c, "obligation") ??
                    attr(c, "implication") ??
                    [
                      attr(c, "interest"),
                      attr(c, "influence") && `Influence: ${attr(c, "influence")}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")) ||
                    "—"}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>
    </>
  );
}

// Capability -------------------------------------------------------------------------

function CapabilityViews({ slug, objects, architecture, graph }: ViewProps) {
  const capabilities = flattenTree(buildTree(ofType(objects, "capability"), graph, ["part_of"]));
  const roles = ofType(objects, "role");
  const skills = ofType(objects, "skill");
  const gaps = ofType(objects, "capability_gap");
  const stages = ofType(objects, "talent_stage").sort(bySequence);

  return (
    <>
      <Section
        title="Capability map"
        description="Tier and current readiness are kept separate from architecture maturity."
        empty={capabilities.length === 0}
      >
        <Table>
          <thead>
            <tr>
              <Th>Capability</Th>
              <Th>Tier</Th>
              <Th>Readiness</Th>
              <Th>Ownership</Th>
              <Th>Maturity</Th>
            </tr>
          </thead>
          <tbody>
            {capabilities.map(({ item, depth }) => (
              <tr key={item.id}>
                <Td style={{ paddingLeft: `${depth * 1.5}rem` }}>
                  <Title slug={slug} element={item} />
                  {rawAttr(item, "leadership_capability") ? (
                    <span className="text-xs text-ink-subtle">Leadership capability</span>
                  ) : null}
                </Td>
                <Td className="whitespace-nowrap">{attr(item, "tier") ?? "—"}</Td>
                <Td className="whitespace-nowrap">{attr(item, "current_readiness") ?? "—"}</Td>
                <Td className="whitespace-nowrap">{attr(item, "ownership_model") ?? "—"}</Td>
                <Td className="whitespace-nowrap">
                  <MaturityMark maturity={item.object!.maturity} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>

      <Section
        title="Roles and skills"
        description="The proficiency each role requires, from role requires skill relationships."
        empty={roles.length === 0 || skills.length === 0}
      >
        <Table>
          <thead>
            <tr>
              <Th>Role</Th>
              {skills.map((s) => (
                <Th key={s.id} className="text-center normal-case">
                  <ElementLink slug={slug} element={s} />
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id}>
                <Td>
                  <Title slug={slug} element={role} />
                </Td>
                {skills.map((skill) => {
                  const link = graph
                    .targets(role.id, "requires")
                    .find((e) => e.target_element_id === skill.id);
                  return (
                    <Td key={skill.id} className="text-center text-xs">
                      {link
                        ? link.required_proficiency
                          ? SKILL_PROFICIENCY_LABELS[link.required_proficiency as SkillProficiency]
                          : "Required"
                        : ""}
                    </Td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>

      <Section title="Capability gaps" empty={gaps.length === 0}>
        <Table>
          <thead>
            <tr>
              <Th>Gap</Th>
              <Th>Gap in</Th>
              <Th>Current → required</Th>
              <Th>Closure</Th>
            </tr>
          </thead>
          <tbody>
            {gaps.map((g) => (
              <tr key={g.id}>
                <Td>
                  <Title slug={slug} element={g} />
                </Td>
                <Td>
                  <Links
                    slug={slug}
                    architecture={architecture}
                    ids={graph.targets(g.id, "gap_in").map((e) => e.target_element_id)}
                  />
                </Td>
                <Td className="text-ink-muted">
                  {[attr(g, "current_state"), attr(g, "required_state")]
                    .map((v) => v ?? "—")
                    .join(" → ")}
                </Td>
                <Td className="whitespace-nowrap">{attr(g, "closure_approach") ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>

      <Section
        title="Talent sequence"
        description="The order in which people and capabilities are brought in."
        empty={stages.length === 0}
      >
        <ol className="space-y-4">
          {stages.map((stage) => (
            <li key={stage.id} className="grid grid-cols-[3rem_1fr] gap-3">
              <span className="font-serif text-2xl text-ink-subtle tabular-nums">
                {String(rawAttr(stage, "sequence") ?? "·")}
              </span>
              <div className="space-y-1 text-sm">
                <Title slug={slug} element={stage} />
                {attr(stage, "trigger_condition") ? (
                  <p className="text-ink-muted">Trigger: {attr(stage, "trigger_condition")}</p>
                ) : null}
                <p className="text-ink-muted">
                  Introduces:{" "}
                  <Links
                    slug={slug}
                    architecture={architecture}
                    ids={graph.targets(stage.id, "introduces").map((e) => e.target_element_id)}
                  />
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Section>
    </>
  );
}

// Strategic Model --------------------------------------------------------------------

function StrategicModelViews({ slug, objects, architecture, graph }: ViewProps) {
  const outcomes = ofType(objects, "intended_outcome");
  const models = ofType(objects, "strategic_model");
  const logic = objects.filter((o) =>
    ["structural_leverage", "differentiation_logic", "strategic_implication"].includes(
      o.object!.object_type,
    ),
  );
  const ids = (edges: RelationshipRow[], end: "source" | "target") =>
    edges.map((e) => (end === "source" ? e.source_element_id : e.target_element_id));

  return (
    <>
      <Section
        title="Intended outcomes"
        description="Desired conditions, what serves them, how they are measured (in Application) and what they rest on."
        empty={outcomes.length === 0}
      >
        <div className="space-y-6">
          {outcomes.map((o) => (
            <div key={o.id} className="space-y-2 border-l-2 border-accent/40 pl-4">
              <Title slug={slug} element={o} />
              {attr(o, "desired_condition") ? (
                <p className="text-sm text-ink">{attr(o, "desired_condition")}</p>
              ) : null}
              <dl className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
                <Linked label="Served by">
                  <Links
                    slug={slug}
                    architecture={architecture}
                    ids={ids(graph.sources(o.id, "serves"), "source")}
                  />
                </Linked>
                <Linked label="Measured by">
                  <Links
                    slug={slug}
                    architecture={architecture}
                    ids={ids(graph.targets(o.id, "measured_by"), "target")}
                  />
                </Linked>
                <Linked label="Rests on">
                  <Links
                    slug={slug}
                    architecture={architecture}
                    ids={ids(graph.sources(o.id, "underpins"), "source")}
                  />
                </Linked>
              </dl>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Applied strategic models"
        description="How each model applies here and where it stops applying, with its implications and the leverage it uses."
        empty={models.length === 0}
      >
        <div className="space-y-6">
          {models.map((m) => (
            <div key={m.id} className="space-y-2">
              <Title slug={slug} element={m} />
              <p className="text-sm text-ink-muted">
                {[
                  attr(m, "application"),
                  attr(m, "applicability_limits") && `Limits: ${attr(m, "applicability_limits")}`,
                ]
                  .filter(Boolean)
                  .join(" ")}
              </p>
              <dl className="grid grid-cols-1 gap-4 text-sm md:grid-cols-4">
                <Linked label="Implies">
                  <Links
                    slug={slug}
                    architecture={architecture}
                    ids={ids(graph.targets(m.id, "implies"), "target")}
                  />
                </Linked>
                <Linked label="Exploits">
                  <Links
                    slug={slug}
                    architecture={architecture}
                    ids={ids(graph.targets(m.id, "exploits"), "target")}
                  />
                </Linked>
                <Linked label="Shapes">
                  <Links
                    slug={slug}
                    architecture={architecture}
                    ids={ids(graph.targets(m.id, "shapes"), "target")}
                  />
                </Linked>
                <Linked label="Rests on">
                  <Links
                    slug={slug}
                    architecture={architecture}
                    ids={ids(graph.sources(m.id, "underpins"), "source")}
                  />
                </Linked>
              </dl>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Leverage, differentiation and implications" empty={logic.length === 0}>
        <Table>
          <thead>
            <tr>
              <Th>Element</Th>
              <Th>Logic</Th>
              <Th>Shapes</Th>
            </tr>
          </thead>
          <tbody>
            {logic.map((l) => (
              <tr key={l.id}>
                <Td>
                  <Title slug={slug} element={l} />
                </Td>
                <Td className="text-ink-muted">
                  {attr(l, "mechanism") ??
                    attr(l, "basis_of_difference") ??
                    attr(l, "implication") ??
                    "—"}
                </Td>
                <Td>
                  <Links
                    slug={slug}
                    architecture={architecture}
                    ids={ids(graph.targets(l.id, "shapes"), "target")}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>
    </>
  );
}

// Application ------------------------------------------------------------------------

function ApplicationViews({ slug, objects, architecture, graph }: ViewProps) {
  const structure = flattenTree(
    buildTree(
      objects.filter((o) =>
        ["operating_model", "application_format", "workflow"].includes(o.object!.object_type),
      ),
      graph,
      ["part_of"],
    ),
  );
  const holders = architecture.elements.filter(
    (e) => e.object?.object_type === "governance_body" || e.object?.object_type === "role",
  );
  const rights = ofType(objects, "decision_right");
  const rightHolders = holders.filter((h) =>
    rights.some((r) => graph.targets(h.id, "holds").some((e) => e.target_element_id === r.id)),
  );
  const metrics = ofType(objects, "metric");
  const stages = ofType(objects, "scaling_stage").sort(bySequence);

  return (
    <>
      <Section
        title="Operating model"
        description="The operating model, its application formats and workflows (is part of)."
        empty={structure.length === 0}
      >
        <ul className="space-y-1.5">
          {structure.map(({ item, depth }) => (
            <li key={item.id} style={{ paddingLeft: `${depth * 1.5}rem` }} className="text-sm">
              <span className="flex flex-wrap items-baseline gap-3">
                <Title slug={slug} element={item} />
                <span className="text-xs text-ink-subtle">
                  {item.object!.object_type === "operating_model"
                    ? "Operating model"
                    : item.object!.object_type === "workflow"
                      ? "Workflow"
                      : (attr(item, "format_kind") ?? "Application format")}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Decision rights"
        description="Which governance bodies and roles hold each class of decision."
        empty={rights.length === 0}
      >
        <Table>
          <thead>
            <tr>
              <Th>Decision right</Th>
              <Th>Decides · consulted · veto · informed</Th>
              {rightHolders.map((h) => (
                <Th key={h.id} className="text-center normal-case">
                  <ElementLink slug={slug} element={h} />
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rights.map((r) => (
              <tr key={r.id}>
                <Td>
                  <Title slug={slug} element={r} />
                  {attr(r, "decision_class") ? (
                    <p className="text-xs text-ink-subtle">{attr(r, "decision_class")}</p>
                  ) : null}
                </Td>
                <Td className="text-xs text-ink-muted">
                  {(["decides", "consulted", "veto", "informed"] as const)
                    .map((k) => attr(r, k))
                    .map((v) => v ?? "—")
                    .join(" · ")}
                </Td>
                {rightHolders.map((h) => (
                  <Td key={h.id} className="text-center">
                    {graph.targets(h.id, "holds").some((e) => e.target_element_id === r.id)
                      ? "Holds"
                      : ""}
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>

      <Section
        title="Measurement system"
        description="Each metric and what it measures. The measure is kept separate from the outcome."
        empty={metrics.length === 0}
      >
        <Table>
          <thead>
            <tr>
              <Th>Metric</Th>
              <Th>Measures</Th>
              <Th>Target · cadence</Th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.id}>
                <Td>
                  <Title slug={slug} element={m} />
                  {attr(m, "definition") ? (
                    <p className="mt-1 text-xs text-ink-muted">{attr(m, "definition")}</p>
                  ) : null}
                </Td>
                <Td>
                  <Links
                    slug={slug}
                    architecture={architecture}
                    ids={graph.sources(m.id, "measured_by").map((e) => e.source_element_id)}
                  />
                </Td>
                <Td className="text-xs text-ink-muted">
                  {[attr(m, "direction"), attr(m, "target"), attr(m, "cadence")]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>

      <Section title="Scaling sequence" empty={stages.length === 0}>
        <ol className="space-y-4">
          {stages.map((stage) => (
            <li key={stage.id} className="grid grid-cols-[3rem_1fr] gap-3">
              <span className="font-serif text-2xl text-ink-subtle tabular-nums">
                {String(rawAttr(stage, "sequence") ?? "·")}
              </span>
              <div className="space-y-1 text-sm">
                <Title slug={slug} element={stage} />
                <p className="text-ink-muted">
                  {[
                    attr(stage, "entry_condition") && `Enter: ${attr(stage, "entry_condition")}`,
                    attr(stage, "exit_condition") && `Exit: ${attr(stage, "exit_condition")}`,
                  ]
                    .filter(Boolean)
                    .map((line) => (
                      <Fragment key={String(line)}>
                        {line}
                        <br />
                      </Fragment>
                    ))}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Section>
    </>
  );
}

function Linked({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-ink-subtle uppercase">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

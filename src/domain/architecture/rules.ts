import { DOMAINS, type ArchitectureDomain, type ElementKind } from "./catalog";
import {
  OBJECT_TYPES,
  PHASE_4_RULE_SPEC,
  PHASE_5_KINDS,
  PHASE_5_RULE_SPEC,
  RECORD_KINDS,
  RELATIONSHIP_RULE_SPEC,
  RELATIONSHIP_TYPES,
} from "./vocabulary";

/**
 * The relationship pairing rules, expanded exactly as the migration expands
 * them into public.relationship_rules. The database is the authority (the
 * guard trigger refuses any other pairing); this copy lets forms offer only
 * the relationship types a pair can hold.
 */

export type ObjectTypeKey = (typeof OBJECT_TYPES)[number]["key"];
export type RelationshipTypeKey = (typeof RELATIONSHIP_TYPES)[number]["key"];

/** One end of a rule: a core object of a type, or a non-object element of a kind. */
export type NonObjectKind = Exclude<ElementKind, "object">;
export type ElementClass =
  { kind: "object"; objectType: ObjectTypeKey } | { kind: NonObjectKind; objectType: null };

export type RelationshipRule = {
  relationshipType: RelationshipTypeKey;
  source: ElementClass;
  target: ElementClass;
};

const objectClass = (objectType: ObjectTypeKey): ElementClass => ({ kind: "object", objectType });
const recordClass = (kind: NonObjectKind): ElementClass => ({ kind, objectType: null });

export function classKey(c: ElementClass): string {
  return c.kind === "object" ? c.objectType : c.kind;
}

/** Every non-object kind a plain rule token may name (Project Intelligence records + Phase 5 kinds). */
const ALL_NON_OBJECT_KINDS: readonly string[] = [...RECORD_KINDS, ...PHASE_5_KINDS];

function isRecordKind(token: string): token is NonObjectKind {
  return ALL_NON_OBJECT_KINDS.includes(token);
}

function tokenItems(token: string): ElementClass[] {
  if (token.startsWith("@")) {
    const group = token.slice(1);
    if ((DOMAINS as readonly string[]).includes(group)) {
      return OBJECT_TYPES.filter((t) => t.domain === group).map((t) => objectClass(t.key));
    }
    if (group === "core") return OBJECT_TYPES.map((t) => objectClass(t.key));
    if (group === "record") return RECORD_KINDS.map(recordClass);
    if (group === "element") {
      return [...OBJECT_TYPES.map((t) => objectClass(t.key)), ...RECORD_KINDS.map(recordClass)];
    }
    throw new Error(`Unknown rule group ${token}`);
  }
  if (isRecordKind(token)) return [recordClass(token)];
  if (OBJECT_TYPES.some((t) => t.key === token)) return [objectClass(token as ObjectTypeKey)];
  throw new Error(`Unknown rule token ${token}`);
}

/** Expand a token list: includes in order, then remove every -excluded item. */
export function expandTokens(tokens: readonly string[]): ElementClass[] {
  const included: ElementClass[] = [];
  const excluded = new Set<string>();
  for (const raw of tokens) {
    const negated = raw.startsWith("-");
    const items = tokenItems(negated ? raw.slice(1) : raw);
    for (const item of items) {
      if (negated) excluded.add(classKey(item));
      else if (!included.some((i) => classKey(i) === classKey(item))) included.push(item);
    }
  }
  return included.filter((i) => !excluded.has(classKey(i)));
}

function buildRules(): RelationshipRule[] {
  const rules: RelationshipRule[] = [];
  const seen = new Set<string>();
  for (const [type, sources, targets] of [
    ...RELATIONSHIP_RULE_SPEC,
    ...PHASE_4_RULE_SPEC,
    ...PHASE_5_RULE_SPEC,
  ]) {
    for (const source of expandTokens(sources)) {
      for (const target of expandTokens(targets)) {
        const key = `${type}|${classKey(source)}|${classKey(target)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rules.push({ relationshipType: type as RelationshipTypeKey, source, target });
      }
    }
  }
  // supersedes: an element is replaced only by another of the same kind and type.
  for (const item of expandTokens(["@element"])) {
    rules.push({ relationshipType: "supersedes", source: item, target: item });
  }
  return rules;
}

export const RELATIONSHIP_RULES: readonly RelationshipRule[] = buildRules();

const ruleIndex = new Map<string, Set<RelationshipTypeKey>>();
for (const rule of RELATIONSHIP_RULES) {
  const key = `${classKey(rule.source)}|${classKey(rule.target)}`;
  let set = ruleIndex.get(key);
  if (!set) ruleIndex.set(key, (set = new Set()));
  set.add(rule.relationshipType);
}

export function isAllowedPairing(
  relationshipType: RelationshipTypeKey,
  source: ElementClass,
  target: ElementClass,
): boolean {
  return ruleIndex.get(`${classKey(source)}|${classKey(target)}`)?.has(relationshipType) ?? false;
}

/** Relationship types never offered for a free-form insert: written only by an operation. */
const RESTRICTED_WRITE_TYPES: readonly RelationshipTypeKey[] = ["supersedes", "validates"];

/**
 * Relationship types an editor may create between two elements, in
 * vocabulary order. supersedes and validates are excluded: only their
 * dedicated operations write them (D13).
 */
export function allowedRelationshipTypes(
  source: ElementClass,
  target: ElementClass,
): RelationshipTypeKey[] {
  const allowed = ruleIndex.get(`${classKey(source)}|${classKey(target)}`);
  if (!allowed) return [];
  return RELATIONSHIP_TYPES.map((t) => t.key).filter(
    (key) => !RESTRICTED_WRITE_TYPES.includes(key) && allowed.has(key),
  );
}

export function relationshipType(key: string) {
  return RELATIONSHIP_TYPES.find((t) => t.key === key);
}

export function objectType(key: string) {
  return OBJECT_TYPES.find((t) => t.key === key);
}

export function objectTypesIn(domain: ArchitectureDomain) {
  return OBJECT_TYPES.filter((t) => t.domain === domain);
}

/** The class of an element as loaded from the database. */
export function elementClass(kind: string, objectTypeKey: string | null): ElementClass {
  if (kind === "object") return objectClass(objectTypeKey as ObjectTypeKey);
  return recordClass(kind as NonObjectKind);
}

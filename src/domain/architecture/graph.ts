/**
 * Pure helpers over an engagement's relationships, used by the domain views
 * (maps, matrices, sequences) and the trace view. Retired relationships are
 * history, not structure, so they are left out.
 */

export type Edge = {
  id: string;
  source_element_id: string;
  target_element_id: string;
  relationship_type: string;
  required_proficiency?: string | null;
  retired_at?: string | null;
};

export type Graph<E extends Edge = Edge> = {
  edges: E[];
  /** Targets of `id` along `type` (source → target). */
  targets: (id: string, type: string) => E[];
  /** Sources pointing at `id` along `type`. */
  sources: (id: string, type: string) => E[];
};

export function buildGraph<E extends Edge>(relationships: readonly E[]): Graph<E> {
  const edges = relationships.filter((r) => !r.retired_at);
  const out = new Map<string, E[]>();
  const into = new Map<string, E[]>();
  for (const e of edges) {
    const o = `${e.source_element_id}|${e.relationship_type}`;
    const i = `${e.target_element_id}|${e.relationship_type}`;
    out.set(o, [...(out.get(o) ?? []), e]);
    into.set(i, [...(into.get(i) ?? []), e]);
  }
  return {
    edges,
    targets: (id, type) => out.get(`${id}|${type}`) ?? [],
    sources: (id, type) => into.get(`${id}|${type}`) ?? [],
  };
}

export type TreeNode<T> = { item: T; children: TreeNode<T>[] };

/**
 * A hierarchy from child → parent relationships (part_of, specializes).
 * Roots are the items with no parent among `items`. Relationship cycles are
 * refused by the database; `seen` guards the rendering anyway.
 */
export function buildTree<T extends { id: string }>(
  items: readonly T[],
  graph: Graph,
  childTypes: readonly string[],
): TreeNode<T>[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const parentOf = new Map<string, string>();
  for (const item of items) {
    for (const type of childTypes) {
      const parent = graph.targets(item.id, type).find((e) => byId.has(e.target_element_id));
      if (parent && !parentOf.has(item.id)) parentOf.set(item.id, parent.target_element_id);
    }
  }
  const seen = new Set<string>();
  const node = (item: T): TreeNode<T> => {
    seen.add(item.id);
    return {
      item,
      children: items
        .filter((c) => parentOf.get(c.id) === item.id && !seen.has(c.id))
        .map((c) => node(c)),
    };
  };
  return items.filter((i) => !parentOf.has(i.id)).map((i) => node(i));
}

export function flattenTree<T>(
  nodes: readonly TreeNode<T>[],
  depth = 0,
): { item: T; depth: number }[] {
  return nodes.flatMap((n) => [{ item: n.item, depth }, ...flattenTree(n.children, depth + 1)]);
}

/**
 * Everything connected to `start` within `depth` hops, in either direction:
 * the trace from knowledge through capability and strategy to application.
 */
export function traceFrom(graph: Graph, start: string, depth = 2) {
  const reached = new Map<string, number>([[start, 0]]);
  let frontier = [start];
  for (let hop = 1; hop <= depth; hop++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const e of graph.edges) {
        const other =
          e.source_element_id === id
            ? e.target_element_id
            : e.target_element_id === id
              ? e.source_element_id
              : null;
        if (other && !reached.has(other)) {
          reached.set(other, hop);
          next.push(other);
        }
      }
    }
    frontier = next;
  }
  reached.delete(start);
  return reached;
}

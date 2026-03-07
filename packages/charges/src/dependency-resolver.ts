import type { ChargeDependencyRow, ChargeDefinitionRow } from './types.js';

export interface ResolvedOrder {
  /** Charge definitions in safe calculation order */
  orderedDefinitions: ChargeDefinitionRow[];
  /**
   * Map: dependentChargeId → chargeId it uses as its numeric base.
   * Only populated for 'base_of' dependencies.
   */
  baseOf: Map<string, string>;
  /**
   * Set of charge definition IDs that are excluded due to 'exclusive' conflicts.
   * When two charges are mutually exclusive, the lower-priority one is excluded.
   */
  excluded: Set<string>;
}

/**
 * Resolves charge calculation order by performing a topological sort on the
 * dependency graph. Handles all three dependency types:
 *   - 'after':     dependent must run after depends_on (ordering constraint)
 *   - 'base_of':  dependent uses depends_on's computed amount as its base (ordering + linkage)
 *   - 'exclusive': only the higher-priority definition applies (exclusion)
 *
 * Throws if a circular dependency is detected.
 */
export function resolveCalculationOrder(
  definitions: ChargeDefinitionRow[],
  dependencies: ChargeDependencyRow[],
): ResolvedOrder {
  const defMap = new Map<string, ChargeDefinitionRow>(definitions.map((d) => [d.id, d]));
  const excluded = new Set<string>();
  const baseOf = new Map<string, string>(); // dependentId → dependsOnId

  // Process exclusive dependencies: exclude the lower calcPriority definition
  for (const dep of dependencies) {
    if (dep.dependencyType !== 'exclusive') continue;
    const a = defMap.get(dep.dependentChargeId);
    const b = defMap.get(dep.dependsOnChargeId);
    if (!a || !b) continue;
    // Higher calcPriority number = lower precedence (runs later/less important)
    // Exclude the one with the higher calcPriority number
    if (a.calcPriority >= b.calcPriority) {
      excluded.add(a.id);
    } else {
      excluded.add(b.id);
    }
  }

  // Build adjacency list for 'after' and 'base_of' dependencies
  // edges[A] = [B, C, ...] means A must come BEFORE B and C
  const edges = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();

  for (const def of definitions) {
    if (!excluded.has(def.id)) {
      edges.set(def.id, new Set());
      inDegree.set(def.id, 0);
    }
  }

  for (const dep of dependencies) {
    if (dep.dependencyType === 'exclusive') continue;
    if (excluded.has(dep.dependentChargeId) || excluded.has(dep.dependsOnChargeId)) continue;

    const fromId = dep.dependsOnChargeId; // must run first
    const toId = dep.dependentChargeId;    // must run after

    if (dep.dependencyType === 'base_of') {
      // Record that toId uses fromId's result as its base
      baseOf.set(toId, fromId);
    }

    const edgeSet = edges.get(fromId);
    if (edgeSet && !edgeSet.has(toId)) {
      edgeSet.add(toId);
      inDegree.set(toId, (inDegree.get(toId) ?? 0) + 1);
    }
  }

  // Kahn's algorithm
  // Initial queue: nodes with no incoming edges, sorted by calcPriority (ascending = first)
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }
  queue.sort((a, b) => {
    const da = defMap.get(a)!.calcPriority;
    const db = defMap.get(b)!.calcPriority;
    return da - db;
  });

  const orderedIds: string[] = [];

  while (queue.length > 0) {
    // Pick lowest calcPriority
    queue.sort((a, b) => (defMap.get(a)!.calcPriority) - (defMap.get(b)!.calcPriority));
    const current = queue.shift()!;
    orderedIds.push(current);

    for (const neighbor of edges.get(current) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  const activeCount = definitions.filter((d) => !excluded.has(d.id)).length;
  if (orderedIds.length !== activeCount) {
    throw new Error(
      `Circular dependency detected in charge definitions. Processed ${orderedIds.length}/${activeCount} definitions.`
    );
  }

  const orderedDefinitions = orderedIds
    .map((id) => defMap.get(id))
    .filter((d): d is ChargeDefinitionRow => d !== undefined);

  return { orderedDefinitions, baseOf, excluded };
}

import type { ArchiMateElement, ArchiMateLayer, ArchiMateModel, ArchiMateRelation, ArchiMateRelationType } from "./types.js";

// ---------------------------------------------------------------------------
// Filter helpers
// ---------------------------------------------------------------------------

export function filterElements(
  model: ArchiMateModel,
  opts: { layer?: ArchiMateLayer; type?: string; name?: string },
): ArchiMateElement[] {
  return model.elements.filter((el) => {
    if (opts.layer && el.layer !== opts.layer) return false;
    if (opts.type && el.type !== opts.type) return false;
    if (opts.name && !el.name.toLowerCase().includes(opts.name.toLowerCase())) return false;
    return true;
  });
}

export function filterRelations(
  model: ArchiMateModel,
  opts: { sourceId?: string; targetId?: string; type?: ArchiMateRelationType },
): ArchiMateRelation[] {
  return model.relations.filter((rel) => {
    if (opts.sourceId && rel.sourceId !== opts.sourceId) return false;
    if (opts.targetId && rel.targetId !== opts.targetId) return false;
    if (opts.type && rel.type !== opts.type) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// BFS shortest-path
// ---------------------------------------------------------------------------

export interface PathResult {
  found: boolean;
  path: string[]; // sequence of element IDs
  relations: string[]; // sequence of relation IDs used
}

export function findPath(
  model: ArchiMateModel,
  fromId: string,
  toId: string,
): PathResult {
  if (fromId === toId) {
    return { found: true, path: [fromId], relations: [] };
  }

  // Build adjacency: elementId → list of { neighborId, relationId }
  const adjacency = new Map<string, Array<{ neighborId: string; relationId: string }>>();

  for (const el of model.elements) {
    adjacency.set(el.id, []);
  }

  for (const rel of model.relations) {
    const srcList = adjacency.get(rel.sourceId);
    const tgtList = adjacency.get(rel.targetId);
    srcList?.push({ neighborId: rel.targetId, relationId: rel.id });
    tgtList?.push({ neighborId: rel.sourceId, relationId: rel.id });
  }

  // BFS
  const visited = new Set<string>([fromId]);
  const queue: Array<{ elementId: string; path: string[]; relations: string[] }> = [
    { elementId: fromId, path: [fromId], relations: [] },
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    const neighbors = adjacency.get(current.elementId) ?? [];
    for (const { neighborId, relationId } of neighbors) {
      if (visited.has(neighborId)) continue;
      visited.add(neighborId);

      const newPath = [...current.path, neighborId];
      const newRelations = [...current.relations, relationId];

      if (neighborId === toId) {
        return { found: true, path: newPath, relations: newRelations };
      }

      queue.push({ elementId: neighborId, path: newPath, relations: newRelations });
    }
  }

  return { found: false, path: [], relations: [] };
}

// ---------------------------------------------------------------------------
// Summary helpers
// ---------------------------------------------------------------------------

export interface ModelSummary {
  modelId: string;
  modelName: string;
  totalElements: number;
  totalRelations: number;
  totalViews: number;
  elementsByLayer: Record<string, number>;
  relationsByType: Record<string, number>;
  viewNames: string[];
}

export function buildSummary(model: ArchiMateModel): ModelSummary {
  const elementsByLayer: Record<string, number> = {};
  for (const el of model.elements) {
    elementsByLayer[el.layer] = (elementsByLayer[el.layer] ?? 0) + 1;
  }

  const relationsByType: Record<string, number> = {};
  for (const rel of model.relations) {
    relationsByType[rel.type] = (relationsByType[rel.type] ?? 0) + 1;
  }

  return {
    modelId: model.id,
    modelName: model.name,
    totalElements: model.elements.length,
    totalRelations: model.relations.length,
    totalViews: model.views.length,
    elementsByLayer,
    relationsByType,
    viewNames: model.views.map((v) => v.name),
  };
}

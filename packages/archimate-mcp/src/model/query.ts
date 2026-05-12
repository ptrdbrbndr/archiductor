import type { ArchiMateElement, ArchiMateLayer, ArchiMateModel, ArchiMateRelation, ArchiMateRelationType } from "./types.js";

// ---------------------------------------------------------------------------
// Filter helpers
// ---------------------------------------------------------------------------

export function filterElements(
  model: ArchiMateModel,
  opts: { layer?: ArchiMateLayer; type?: string; name?: string },
): ArchiMateElement[] {
  const result: ArchiMateElement[] = [];
  for (const el of model.elements.values()) {
    if (opts.layer && el.layer !== opts.layer) continue;
    if (opts.type && el.type !== opts.type) continue;
    if (opts.name && !el.name.toLowerCase().includes(opts.name.toLowerCase())) continue;
    result.push(el);
  }
  return result;
}

export function filterRelations(
  model: ArchiMateModel,
  opts: { sourceId?: string; targetId?: string; type?: ArchiMateRelationType },
): ArchiMateRelation[] {
  const result: ArchiMateRelation[] = [];
  for (const rel of model.relations.values()) {
    if (opts.sourceId && rel.sourceId !== opts.sourceId) continue;
    if (opts.targetId && rel.targetId !== opts.targetId) continue;
    if (opts.type && rel.type !== opts.type) continue;
    result.push(rel);
  }
  return result;
}

// ---------------------------------------------------------------------------
// BFS shortest-path
// ---------------------------------------------------------------------------

export interface PathResult {
  elements: ArchiMateElement[];
  relations: ArchiMateRelation[];
}

export function findPath(
  model: ArchiMateModel,
  fromId: string,
  toId: string,
): PathResult | null {
  const fromEl = model.elements.get(fromId);
  if (!fromEl) return null;

  if (fromId === toId) {
    return { elements: [fromEl], relations: [] };
  }

  // Build adjacency: elementId → list of { neighborId, relationId }
  const adjacency = new Map<string, Array<{ neighborId: string; relationId: string }>>();

  for (const el of model.elements.values()) {
    adjacency.set(el.id, []);
  }

  for (const rel of model.relations.values()) {
    const srcList = adjacency.get(rel.sourceId);
    const tgtList = adjacency.get(rel.targetId);
    srcList?.push({ neighborId: rel.targetId, relationId: rel.id });
    tgtList?.push({ neighborId: rel.sourceId, relationId: rel.id });
  }

  // BFS
  const visited = new Set<string>([fromId]);
  const queue: Array<{ elementId: string; elementIds: string[]; relationIds: string[] }> = [
    { elementId: fromId, elementIds: [fromId], relationIds: [] },
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    const neighbors = adjacency.get(current.elementId) ?? [];
    for (const { neighborId, relationId } of neighbors) {
      if (visited.has(neighborId)) continue;
      visited.add(neighborId);

      const newElementIds = [...current.elementIds, neighborId];
      const newRelationIds = [...current.relationIds, relationId];

      if (neighborId === toId) {
        const elements = newElementIds.map((id) => model.elements.get(id)!).filter(Boolean);
        const relations = newRelationIds.map((id) => model.relations.get(id)!).filter(Boolean);
        return { elements, relations };
      }

      queue.push({ elementId: neighborId, elementIds: newElementIds, relationIds: newRelationIds });
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Summary helpers
// ---------------------------------------------------------------------------

export interface ModelSummary {
  name: string;
  totalElements: number;
  totalRelations: number;
  totalViews: number;
  elementsByLayer: Record<string, number>;
  relationsByType: Record<string, number>;
}

export function buildSummary(model: ArchiMateModel): ModelSummary {
  const elementsByLayer: Record<string, number> = {};
  for (const el of model.elements.values()) {
    elementsByLayer[el.layer] = (elementsByLayer[el.layer] ?? 0) + 1;
  }

  const relationsByType: Record<string, number> = {};
  for (const rel of model.relations.values()) {
    relationsByType[rel.type] = (relationsByType[rel.type] ?? 0) + 1;
  }

  return {
    name: model.name,
    totalElements: model.elements.size,
    totalRelations: model.relations.size,
    totalViews: model.views.size,
    elementsByLayer,
    relationsByType,
  };
}

/** Alias for buildSummary — preferred name for MCP tool layer. */
export function getModelSummary(model: ArchiMateModel): ModelSummary {
  return buildSummary(model);
}

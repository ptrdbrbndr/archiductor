import { randomUUID } from "node:crypto";
import type {
  ArchiMateElement,
  ArchiMateElementType,
  ArchiMateLayer,
  ArchiMateModel,
  ArchiMateProperty,
  ArchiMateRelation,
  ArchiMateRelationType,
  ArchiMateView,
} from "./types.js";

// ---------------------------------------------------------------------------
// Model factory
// ---------------------------------------------------------------------------

export function createModel(id: string, name: string): ArchiMateModel {
  return {
    id,
    name,
    elements: new Map(),
    relations: new Map(),
    views: new Map(),
  };
}

// ---------------------------------------------------------------------------
// Element mutations — mutate model in place, return the affected entity
// ---------------------------------------------------------------------------

export function addElement(
  model: ArchiMateModel,
  layer: ArchiMateLayer,
  type: ArchiMateElementType,
  name: string,
  properties?: ArchiMateProperty[],
  documentation?: string,
): ArchiMateElement {
  const element: ArchiMateElement = {
    id: `el-${randomUUID()}`,
    name,
    type,
    layer,
    properties: properties ?? [],
    ...(documentation ? { documentation } : {}),
  };
  model.elements.set(element.id, element);
  return element;
}

export function updateElement(
  model: ArchiMateModel,
  elementId: string,
  changes: Partial<Pick<ArchiMateElement, "name" | "type" | "layer" | "documentation" | "properties">>,
): ArchiMateElement {
  const element = model.elements.get(elementId);
  if (!element) throw new Error(`Element not found: ${elementId}`);

  const updated: ArchiMateElement = { ...element, ...changes };
  model.elements.set(elementId, updated);
  return updated;
}

export function removeElement(
  model: ArchiMateModel,
  elementId: string,
  cascade = false,
): void {
  if (!model.elements.has(elementId)) {
    throw new Error(`Element not found: ${elementId}`);
  }
  model.elements.delete(elementId);

  if (cascade) {
    for (const [id, rel] of model.relations) {
      if (rel.sourceId === elementId || rel.targetId === elementId) {
        model.relations.delete(id);
      }
    }
  }

  for (const view of model.views.values()) {
    view.elements = view.elements.filter((e) => e.elementId !== elementId);
  }
}

// ---------------------------------------------------------------------------
// Relation mutations
// ---------------------------------------------------------------------------

export function addRelation(
  model: ArchiMateModel,
  type: ArchiMateRelationType,
  sourceId: string,
  targetId: string,
  properties?: ArchiMateProperty[],
  name?: string,
): ArchiMateRelation {
  if (!model.elements.has(sourceId)) {
    throw new Error(`Source element not found: ${sourceId}`);
  }
  if (!model.elements.has(targetId)) {
    throw new Error(`Target element not found: ${targetId}`);
  }

  const relation: ArchiMateRelation = {
    id: `rel-${randomUUID()}`,
    type,
    sourceId,
    targetId,
    properties: properties ?? [],
    ...(name ? { name } : {}),
  };
  model.relations.set(relation.id, relation);
  return relation;
}

export function removeRelation(
  model: ArchiMateModel,
  relationId: string,
): void {
  if (!model.relations.has(relationId)) {
    throw new Error(`Relation not found: ${relationId}`);
  }
  model.relations.delete(relationId);

  for (const view of model.views.values()) {
    view.relations = view.relations.filter((rid) => rid !== relationId);
  }
}

// ---------------------------------------------------------------------------
// View mutations
// ---------------------------------------------------------------------------

export function createView(
  model: ArchiMateModel,
  name: string,
  viewpoint?: string,
): ArchiMateView {
  const view: ArchiMateView = {
    id: `view-${randomUUID()}`,
    name,
    ...(viewpoint ? { viewpoint } : {}),
    elements: [],
    relations: [],
  };
  model.views.set(view.id, view);
  return view;
}

export function addToView(
  model: ArchiMateModel,
  viewId: string,
  elementId: string,
): void {
  const view = model.views.get(viewId);
  if (!view) throw new Error(`View not found: ${viewId}`);

  if (!view.elements.some((e) => e.elementId === elementId)) {
    view.elements.push({ elementId });
  }
}

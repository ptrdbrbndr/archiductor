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
import { ELEMENT_LAYER } from "./types.js";

// ---------------------------------------------------------------------------
// Model mutation helpers — all functions are pure; they return a new model.
// ---------------------------------------------------------------------------

export function addElement(
  model: ArchiMateModel,
  type: ArchiMateElementType,
  name: string,
  properties?: ArchiMateProperty[],
  documentation?: string,
): { model: ArchiMateModel; element: ArchiMateElement } {
  const layer = ELEMENT_LAYER[type] ?? 'business';
  const element: ArchiMateElement = {
    id: `el-${randomUUID()}`,
    name,
    type,
    layer,
    ...(documentation ? { documentation } : {}),
    properties: properties ?? [],
  };
  const newElements = new Map(model.elements);
  newElements.set(element.id, element);
  return {
    model: { ...model, elements: newElements },
    element,
  };
}

export function updateElement(
  model: ArchiMateModel,
  elementId: string,
  changes: Partial<Pick<ArchiMateElement, "name" | "type" | "layer" | "documentation" | "properties">>,
): ArchiMateModel {
  const element = model.elements.get(elementId);
  if (!element) return model;

  const updated: ArchiMateElement = { ...element, ...changes };
  // Re-infer layer if type changed but layer was not explicitly set
  if (changes.type && !changes.layer) {
    updated.layer = ELEMENT_LAYER[changes.type] ?? 'business';
  }

  const newElements = new Map(model.elements);
  newElements.set(elementId, updated);
  return { ...model, elements: newElements };
}

export function removeElement(
  model: ArchiMateModel,
  elementId: string,
  cascade: boolean,
): ArchiMateModel {
  const newElements = new Map(model.elements);
  newElements.delete(elementId);

  let newRelations = new Map(model.relations);
  if (cascade) {
    const toDelete: string[] = [];
    for (const [id, rel] of newRelations) {
      if (rel.sourceId === elementId || rel.targetId === elementId) {
        toDelete.push(id);
      }
    }
    toDelete.forEach((id) => newRelations.delete(id));
  }

  const newViews = new Map(model.views);
  for (const [id, view] of newViews) {
    newViews.set(id, {
      ...view,
      elements: view.elements.filter((e) => e.elementId !== elementId),
    });
  }

  return { ...model, elements: newElements, relations: newRelations, views: newViews };
}

export function addRelation(
  model: ArchiMateModel,
  type: ArchiMateRelationType,
  sourceId: string,
  targetId: string,
  name?: string,
  properties?: ArchiMateProperty[],
  documentation?: string,
): { model: ArchiMateModel; relation: ArchiMateRelation } {
  const relation: ArchiMateRelation = {
    id: `rel-${randomUUID()}`,
    type,
    sourceId,
    targetId,
    ...(name ? { name } : {}),
    ...(documentation ? { documentation } : {}),
    properties: properties ?? [],
  };
  const newRelations = new Map(model.relations);
  newRelations.set(relation.id, relation);
  return {
    model: { ...model, relations: newRelations },
    relation,
  };
}

export function removeRelation(
  model: ArchiMateModel,
  relationId: string,
): ArchiMateModel {
  const newRelations = new Map(model.relations);
  newRelations.delete(relationId);

  const newViews = new Map(model.views);
  for (const [id, view] of newViews) {
    newViews.set(id, {
      ...view,
      relations: view.relations.filter((rid) => rid !== relationId),
    });
  }
  return { ...model, relations: newRelations, views: newViews };
}

export function createView(
  model: ArchiMateModel,
  name: string,
  viewpoint?: string,
): { model: ArchiMateModel; view: ArchiMateView } {
  const view: ArchiMateView = {
    id: `view-${randomUUID()}`,
    name,
    ...(viewpoint ? { viewpoint } : {}),
    elements: [],
    relations: [],
  };
  const newViews = new Map(model.views);
  newViews.set(view.id, view);
  return {
    model: { ...model, views: newViews },
    view,
  };
}

export function addToView(
  model: ArchiMateModel,
  viewId: string,
  elementId: string,
): ArchiMateModel {
  const view = model.views.get(viewId);
  if (!view) return model;

  if (view.elements.some((e) => e.elementId === elementId)) {
    return model; // already present
  }

  const newViews = new Map(model.views);
  newViews.set(viewId, {
    ...view,
    elements: [...view.elements, { elementId }],
  });
  return { ...model, views: newViews };
}

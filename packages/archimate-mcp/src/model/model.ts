import { randomUUID } from "node:crypto";
import type {
  ArchiMateElement,
  ArchiMateLayer,
  ArchiMateModel,
  ArchiMateProperty,
  ArchiMateRelation,
  ArchiMateRelationType,
  ArchiMateView,
  ArchiMateViewpointType,
} from "./types.js";
import { inferLayer } from "./types.js";

// ---------------------------------------------------------------------------
// Model mutation helpers — all functions are pure; they return a new model.
// ---------------------------------------------------------------------------

export function addElement(
  model: ArchiMateModel,
  layer: ArchiMateLayer,
  type: string,
  name: string,
  properties?: ArchiMateProperty[],
  documentation?: string,
): { model: ArchiMateModel; element: ArchiMateElement } {
  const element: ArchiMateElement = {
    id: `el-${randomUUID()}`,
    name,
    type,
    layer,
    ...(documentation ? { documentation } : {}),
    ...(properties?.length ? { properties } : {}),
  };
  return {
    model: { ...model, elements: [...model.elements, element] },
    element,
  };
}

export function updateElement(
  model: ArchiMateModel,
  elementId: string,
  changes: Partial<Pick<ArchiMateElement, "name" | "type" | "layer" | "documentation" | "properties">>,
): ArchiMateModel {
  const elements = model.elements.map((el) => {
    if (el.id !== elementId) return el;
    const updated = { ...el, ...changes };
    // Re-infer layer if type changed but layer was not explicitly set
    if (changes.type && !changes.layer) {
      updated.layer = inferLayer(changes.type);
    }
    return updated;
  });
  return { ...model, elements };
}

export function removeElement(
  model: ArchiMateModel,
  elementId: string,
  cascade: boolean,
): ArchiMateModel {
  const elements = model.elements.filter((el) => el.id !== elementId);

  let relations = model.relations;
  if (cascade) {
    relations = relations.filter(
      (rel) => rel.sourceId !== elementId && rel.targetId !== elementId,
    );
  }

  const views = model.views.map((view) => ({
    ...view,
    elementIds: view.elementIds.filter((id) => id !== elementId),
    nodes: view.nodes?.filter((n) => n.elementId !== elementId),
  }));

  return { ...model, elements, relations, views };
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
    ...(properties?.length ? { properties } : {}),
  };
  return {
    model: { ...model, relations: [...model.relations, relation] },
    relation,
  };
}

export function removeRelation(
  model: ArchiMateModel,
  relationId: string,
): ArchiMateModel {
  const relations = model.relations.filter((rel) => rel.id !== relationId);
  const views = model.views.map((view) => ({
    ...view,
    relationIds: view.relationIds.filter((id) => id !== relationId),
    connections: view.connections?.filter((c) => c.relationId !== relationId),
  }));
  return { ...model, relations, views };
}

export function createView(
  model: ArchiMateModel,
  name: string,
  viewpointType?: ArchiMateViewpointType,
): { model: ArchiMateModel; view: ArchiMateView } {
  const view: ArchiMateView = {
    id: `view-${randomUUID()}`,
    name,
    ...(viewpointType ? { viewpointType } : {}),
    elementIds: [],
    relationIds: [],
    nodes: [],
    connections: [],
  };
  return {
    model: { ...model, views: [...model.views, view] },
    view,
  };
}

export function addToView(
  model: ArchiMateModel,
  viewId: string,
  elementId: string,
): ArchiMateModel {
  const views = model.views.map((view) => {
    if (view.id !== viewId) return view;
    if (view.elementIds.includes(elementId)) return view; // already present
    return {
      ...view,
      elementIds: [...view.elementIds, elementId],
      nodes: [...(view.nodes ?? []), { elementId }],
    };
  });
  return { ...model, views };
}

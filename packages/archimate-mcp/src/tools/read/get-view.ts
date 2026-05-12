import type { ArchiMateElement, ArchiMateModel, ArchiMateRelation, ArchiMateView } from "../../model/types.js";

export interface GetViewInput {
  model_id: string;
  view_id: string;
}

export interface ViewDetails {
  view: ArchiMateView;
  elements: ArchiMateElement[];
  relations: ArchiMateRelation[];
}

export function getView(
  model: ArchiMateModel,
  viewId: string,
): ViewDetails | null {
  const view = model.views.get(viewId);
  if (!view) return null;

  const elementIdSet = new Set(view.elements.map(e => e.elementId));
  const relationIdSet = new Set(view.relations);

  const elements: ArchiMateElement[] = [];
  const relations: ArchiMateRelation[] = [];

  for (const el of model.elements.values()) {
    if (elementIdSet.has(el.id)) elements.push(el);
  }

  for (const rel of model.relations.values()) {
    if (relationIdSet.has(rel.id)) relations.push(rel);
  }

  return { view, elements, relations };
}

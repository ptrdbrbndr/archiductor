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
  const view = model.views.find((v) => v.id === viewId);
  if (!view) return null;

  const elementSet = new Set(view.elementIds);
  const relationSet = new Set(view.relationIds);

  const elements = model.elements.filter((el) => elementSet.has(el.id));
  const relations = model.relations.filter((rel) => relationSet.has(rel.id));

  return { view, elements, relations };
}

import type { ArchiMateModel, ArchiMateView } from "../../model/types.js";

export interface ListViewsInput {
  model_id: string;
}

export function listViews(model: ArchiMateModel): Pick<ArchiMateView, "id" | "name" | "viewpoint" | "elements" | "relations">[] {
  const result: Pick<ArchiMateView, "id" | "name" | "viewpoint" | "elements" | "relations">[] = [];
  for (const v of model.views.values()) {
    result.push({
      id: v.id,
      name: v.name,
      ...(v.viewpoint ? { viewpoint: v.viewpoint } : {}),
      elements: v.elements,
      relations: v.relations,
    });
  }
  return result;
}

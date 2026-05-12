import type { ArchiMateModel, ArchiMateView } from "../../model/types.js";

export interface ListViewsInput {
  model_id: string;
}

export function listViews(model: ArchiMateModel): Pick<ArchiMateView, "id" | "name" | "viewpointType" | "elementIds" | "relationIds">[] {
  return model.views.map((v) => ({
    id: v.id,
    name: v.name,
    ...(v.viewpointType ? { viewpointType: v.viewpointType } : {}),
    elementIds: v.elementIds,
    relationIds: v.relationIds,
  }));
}

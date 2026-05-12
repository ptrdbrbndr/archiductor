import type { ArchiMateModel } from "../../model/types.js";
import { addToView } from "../../model/model.js";

export interface AddToViewInput {
  model_id: string;
  view_id: string;
  element_id: string;
}

export function addToViewTool(
  model: ArchiMateModel,
  viewId: string,
  elementId: string,
): ArchiMateModel {
  if (!model.views.has(viewId)) {
    throw new Error(`View not found: ${viewId}`);
  }
  addToView(model, viewId, elementId);
  return model;
}

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
  return addToView(model, viewId, elementId);
}

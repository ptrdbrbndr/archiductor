import type { ArchiMateModel } from "../../model/types.js";
import { removeElement } from "../../model/model.js";

export interface RemoveElementInput {
  model_id: string;
  element_id: string;
  cascade?: boolean;
}

export function removeElementTool(
  model: ArchiMateModel,
  elementId: string,
  cascade: boolean = false,
): ArchiMateModel {
  return removeElement(model, elementId, cascade);
}

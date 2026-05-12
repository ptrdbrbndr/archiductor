import type { ArchiMateElement, ArchiMateLayer, ArchiMateModel, ArchiMateProperty } from "../../model/types.js";
import { updateElement } from "../../model/model.js";

export interface UpdateElementInput {
  model_id: string;
  element_id: string;
  changes: Partial<{
    name: string;
    type: string;
    layer: ArchiMateLayer;
    documentation: string;
    properties: ArchiMateProperty[];
  }>;
}

export interface UpdateElementOutput {
  model: ArchiMateModel;
  updated: ArchiMateElement | undefined;
}

export function updateElementTool(
  model: ArchiMateModel,
  elementId: string,
  changes: UpdateElementInput["changes"],
): UpdateElementOutput {
  const updatedModel = updateElement(model, elementId, changes);
  const updated = updatedModel.elements.find((el) => el.id === elementId);
  return { model: updatedModel, updated };
}

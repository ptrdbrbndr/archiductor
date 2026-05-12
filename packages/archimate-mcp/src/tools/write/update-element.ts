import type { ArchiMateElement, ArchiMateElementType, ArchiMateLayer, ArchiMateModel, ArchiMateProperty } from "../../model/types.js";
import { updateElement } from "../../model/model.js";

export interface UpdateElementInput {
  model_id: string;
  element_id: string;
  changes: Partial<{
    name: string;
    type: ArchiMateElementType;
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
  const typedChanges = changes as Partial<Pick<ArchiMateElement, "name" | "type" | "layer" | "documentation" | "properties">>;
  const updatedModel = updateElement(model, elementId, typedChanges);
  const updated = updatedModel.elements.get(elementId);
  return { model: updatedModel, updated };
}

import type { ArchiMateElement, ArchiMateLayer, ArchiMateModel, ArchiMateProperty } from "../../model/types.js";
import { addElement } from "../../model/model.js";

export interface AddElementInput {
  model_id: string;
  layer: ArchiMateLayer;
  type: string;
  name: string;
  properties?: ArchiMateProperty[];
  documentation?: string;
}

export interface AddElementOutput {
  model: ArchiMateModel;
  element: ArchiMateElement;
}

export function addElementTool(
  model: ArchiMateModel,
  input: Omit<AddElementInput, "model_id">,
): AddElementOutput {
  return addElement(model, input.layer, input.type, input.name, input.properties, input.documentation);
}

import type { ArchiMateElement, ArchiMateElementType, ArchiMateModel, ArchiMateProperty } from "../../model/types.js";
import { ELEMENT_LAYER } from "../../model/types.js";
import { addElement } from "../../model/model.js";

export interface AddElementInput {
  model_id: string;
  type: ArchiMateElementType;
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
  const layer = ELEMENT_LAYER[input.type] ?? 'business';
  const element = addElement(model, layer, input.type, input.name, input.properties, input.documentation);
  return { model, element };
}

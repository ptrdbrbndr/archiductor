import type { ArchiMateElement, ArchiMateModel } from "../../model/types.js";

export interface GetElementInput {
  model_id: string;
  element_id: string;
}

export function getElement(
  model: ArchiMateModel,
  elementId: string,
): ArchiMateElement | null {
  return model.elements.find((el) => el.id === elementId) ?? null;
}

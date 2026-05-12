import type { ArchiMateElement, ArchiMateLayer, ArchiMateModel } from "../../model/types.js";
import { filterElements } from "../../model/query.js";

export interface ListElementsInput {
  model_id: string;
  layer?: ArchiMateLayer;
  type?: string;
  name?: string;
}

export function listElements(
  model: ArchiMateModel,
  opts: Omit<ListElementsInput, "model_id">,
): ArchiMateElement[] {
  return filterElements(model, {
    layer: opts.layer,
    type: opts.type,
    name: opts.name,
  });
}

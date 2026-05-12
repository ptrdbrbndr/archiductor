import type { ArchiMateElement, ArchiMateElementType, ArchiMateLayer, ArchiMateModel, ArchiMateProperty } from "../../model/types.js";
import { ELEMENT_LAYER } from "../../model/types.js";
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

  // Re-infer layer when type changes but layer is not explicitly set
  if (typedChanges.type && !typedChanges.layer) {
    typedChanges.layer = ELEMENT_LAYER[typedChanges.type] ?? 'business';
  }

  try {
    const updated = updateElement(model, elementId, typedChanges);
    return { model, updated };
  } catch {
    return { model, updated: undefined };
  }
}

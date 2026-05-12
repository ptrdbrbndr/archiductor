import type { ArchiMateModel, ArchiMateProperty, ArchiMateRelation, ArchiMateRelationType } from "../../model/types.js";
import { addRelation } from "../../model/model.js";

export interface AddRelationInput {
  model_id: string;
  type: ArchiMateRelationType;
  source_id: string;
  target_id: string;
  name?: string;
  properties?: ArchiMateProperty[];
}

export interface AddRelationOutput {
  model: ArchiMateModel;
  relation: ArchiMateRelation;
}

export function addRelationTool(
  model: ArchiMateModel,
  input: Omit<AddRelationInput, "model_id">,
): AddRelationOutput {
  return addRelation(
    model,
    input.type,
    input.source_id,
    input.target_id,
    input.name,
    input.properties,
  );
}

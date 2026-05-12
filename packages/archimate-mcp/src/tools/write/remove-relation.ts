import type { ArchiMateModel } from "../../model/types.js";
import { removeRelation } from "../../model/model.js";

export interface RemoveRelationInput {
  model_id: string;
  relation_id: string;
}

export function removeRelationTool(
  model: ArchiMateModel,
  relationId: string,
): ArchiMateModel {
  return removeRelation(model, relationId);
}

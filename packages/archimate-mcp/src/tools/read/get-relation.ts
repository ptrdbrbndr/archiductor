import type { ArchiMateModel, ArchiMateRelation } from "../../model/types.js";

export interface GetRelationInput {
  model_id: string;
  relation_id: string;
}

export function getRelation(
  model: ArchiMateModel,
  relationId: string,
): ArchiMateRelation | null {
  return model.relations.find((rel) => rel.id === relationId) ?? null;
}

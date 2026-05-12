import type { ArchiMateModel, ArchiMateRelation, ArchiMateRelationType } from "../../model/types.js";
import { filterRelations } from "../../model/query.js";

export interface ListRelationsInput {
  model_id: string;
  source_id?: string;
  target_id?: string;
  type?: ArchiMateRelationType;
}

export function listRelations(
  model: ArchiMateModel,
  opts: Omit<ListRelationsInput, "model_id">,
): ArchiMateRelation[] {
  return filterRelations(model, {
    sourceId: opts.source_id,
    targetId: opts.target_id,
    type: opts.type,
  });
}

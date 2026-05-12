import type { ArchiMateModel } from "../../model/types.js";
import { buildSummary } from "../../model/query.js";

export interface GetModelSummaryInput {
  model_id: string;
}

export function getModelSummary(model: ArchiMateModel) {
  return buildSummary(model);
}

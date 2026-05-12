import type { ArchiMateModel, ArchiMateView } from "../../model/types.js";
import { createView } from "../../model/model.js";

export interface CreateViewInput {
  model_id: string;
  name: string;
  viewpoint?: string;
}

export interface CreateViewOutput {
  model: ArchiMateModel;
  view: ArchiMateView;
}

export function createViewTool(
  model: ArchiMateModel,
  name: string,
  viewpoint?: string,
): CreateViewOutput {
  return createView(model, name, viewpoint);
}

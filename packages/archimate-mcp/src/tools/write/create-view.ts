import type { ArchiMateModel, ArchiMateView, ArchiMateViewpointType } from "../../model/types.js";
import { createView } from "../../model/model.js";

export interface CreateViewInput {
  model_id: string;
  name: string;
  viewpoint_type?: ArchiMateViewpointType;
}

export interface CreateViewOutput {
  model: ArchiMateModel;
  view: ArchiMateView;
}

export function createViewTool(
  model: ArchiMateModel,
  name: string,
  viewpointType?: ArchiMateViewpointType,
): CreateViewOutput {
  return createView(model, name, viewpointType);
}

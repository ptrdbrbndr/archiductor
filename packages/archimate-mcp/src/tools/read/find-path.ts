import type { ArchiMateModel } from "../../model/types.js";
import { findPath, type PathResult } from "../../model/query.js";

export interface FindPathInput {
  model_id: string;
  from_id: string;
  to_id: string;
}

export interface FindPathOutput extends PathResult {
  fromId: string;
  toId: string;
  hopCount: number;
}

export function findPathTool(
  model: ArchiMateModel,
  fromId: string,
  toId: string,
): FindPathOutput {
  const result = findPath(model, fromId, toId);
  return {
    ...result,
    fromId,
    toId,
    hopCount: result.found ? result.path.length - 1 : -1,
  };
}

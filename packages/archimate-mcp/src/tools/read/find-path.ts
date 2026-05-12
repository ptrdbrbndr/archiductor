import type { ArchiMateElement, ArchiMateModel, ArchiMateRelation } from "../../model/types.js";
import { findPath } from "../../model/query.js";

export interface FindPathInput {
  model_id: string;
  from_id: string;
  to_id: string;
}

export interface FindPathOutput {
  found: boolean;
  elements: ArchiMateElement[];
  relations: ArchiMateRelation[];
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
  if (!result) {
    return { found: false, elements: [], relations: [], fromId, toId, hopCount: -1 };
  }
  return {
    found: true,
    elements: result.elements,
    relations: result.relations,
    fromId,
    toId,
    hopCount: result.elements.length - 1,
  };
}

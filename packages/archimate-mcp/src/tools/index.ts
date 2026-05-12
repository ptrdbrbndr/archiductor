/**
 * MCP tool registry — registers all 15 ArchiMate tools on the given MCP server.
 *
 * Each tool follows the stateless dataflow:
 *   1. Auth → user_id + model_id
 *   2. Fetch OEF XML from Supabase
 *   3. Parse → ArchiMateModel
 *   4. Execute handler
 *   5. (write) Serialize → save
 *   6. Return JSON response
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { parseOef } from "../parser/oef-parser.js";
import { serializeOef } from "../parser/serializer.js";
import { fetchModel, saveModel } from "../storage/supabase.js";
import { validateAuth } from "../auth/middleware.js";

// Read tool handlers
import { getModelSummary } from "./read/get-model-summary.js";
import { listElements } from "./read/list-elements.js";
import { getElement } from "./read/get-element.js";
import { listRelations } from "./read/list-relations.js";
import { getRelation } from "./read/get-relation.js";
import { listViews } from "./read/list-views.js";
import { getView } from "./read/get-view.js";
import { findPathTool } from "./read/find-path.js";

// Write tool handlers
import { addElementTool } from "./write/add-element.js";
import { updateElementTool } from "./write/update-element.js";
import { removeElementTool } from "./write/remove-element.js";
import { addRelationTool } from "./write/add-relation.js";
import { removeRelationTool } from "./write/remove-relation.js";
import { addToViewTool } from "./write/add-to-view.js";
import { createViewTool } from "./write/create-view.js";
import type { ArchiMateLayer, ArchiMateRelationType, ArchiMateElementType } from "../model/types.js";

// ---------------------------------------------------------------------------
// Shared schemas
// ---------------------------------------------------------------------------

const ModelIdSchema = z.string().uuid();
const ElementIdSchema = z.string();
const RelationIdSchema = z.string();
const ViewIdSchema = z.string();
const LayerSchema = z.enum(["motivation", "strategy", "business", "application", "technology", "physical", "implementation_migration"]);
const RelationTypeSchema = z.enum([
  "Association",
  "Access",
  "Influence",
  "Triggering",
  "Flow",
  "Specialization",
  "Aggregation",
  "Composition",
  "Realization",
  "Assignment",
  "Serving",
]);
const PropertySchema = z.object({ key: z.string(), value: z.string() });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toolError(message: string): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text", text: JSON.stringify({ error: message }) }] };
}

function toolOk(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

/**
 * Shared logic: auth + fetch + parse.
 * Returns the model and version, or throws (caller must catch and return toolError).
 */
async function loadModel(
  token: string | undefined,
  modelId: string,
): Promise<{ model: ReturnType<typeof parseOef>; version: number }> {
  const auth = await validateAuth(token, modelId);
  if (!auth.ok) {
    throw new Error(auth.error.message);
  }

  const fetched = await fetchModel(modelId, auth.payload.user_id);
  if (!fetched.ok) {
    throw new Error(fetched.message);
  }

  const model = parseOef(fetched.content);
  return { model, version: fetched.version };
}

/**
 * Shared logic for write tools: load + mutate + save.
 */
async function writeModel<T>(
  token: string | undefined,
  modelId: string,
  mutate: (model: ReturnType<typeof parseOef>) => { model: ReturnType<typeof parseOef>; result: T },
): Promise<{ result: T; version: number } | { error: string }> {
  const auth = await validateAuth(token, modelId);
  if (!auth.ok) {
    return { error: auth.error.message };
  }

  const fetched = await fetchModel(modelId, auth.payload.user_id);
  if (!fetched.ok) {
    return { error: fetched.message };
  }

  const model = parseOef(fetched.content);
  let updatedModel: ReturnType<typeof parseOef>;
  let result: T;
  try {
    const mutated = mutate(model);
    updatedModel = mutated.model;
    result = mutated.result;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
  const xml = serializeOef(updatedModel);

  const saved = await saveModel(modelId, auth.payload.user_id, xml, fetched.version);
  if (!saved.ok) {
    return { error: saved.message };
  }

  return { result, version: saved.version };
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerTools(server: McpServer): void {
  // -----------------------------------------------------------------------
  // READ TOOLS
  // -----------------------------------------------------------------------

  // 1. get_model_summary
  server.tool(
    "get_model_summary",
    "Returns element counts by layer, relation type counts, and a list of all views in the ArchiMate model.",
    {
      model_id: ModelIdSchema.describe("UUID of the ArchiMate model"),
      token: z.string().describe("Bearer JWT token for authentication"),
    },
    async ({ model_id, token }) => {
      try {
        const { model } = await loadModel(token, model_id);
        return toolOk(getModelSummary(model));
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // 2. list_elements
  server.tool(
    "list_elements",
    "Returns a filtered list of elements in the model. Optionally filter by layer, type, or name substring.",
    {
      model_id: ModelIdSchema.describe("UUID of the ArchiMate model"),
      token: z.string().describe("Bearer JWT token"),
      layer: LayerSchema.optional().describe("Filter by ArchiMate layer"),
      type: z.string().optional().describe("Filter by element type (e.g. BusinessActor)"),
      name: z.string().optional().describe("Filter by name substring (case-insensitive)"),
    },
    async ({ model_id, token, layer, type, name }) => {
      try {
        const { model } = await loadModel(token, model_id);
        return toolOk(listElements(model, { layer: layer as ArchiMateLayer | undefined, type, name }));
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // 3. get_element
  server.tool(
    "get_element",
    "Returns the full details of a single element by ID.",
    {
      model_id: ModelIdSchema.describe("UUID of the ArchiMate model"),
      token: z.string().describe("Bearer JWT token"),
      element_id: ElementIdSchema.describe("ID of the element"),
    },
    async ({ model_id, token, element_id }) => {
      try {
        const { model } = await loadModel(token, model_id);
        const element = getElement(model, element_id);
        if (!element) return toolError(`Element ${element_id} not found`);
        return toolOk(element);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // 4. list_relations
  server.tool(
    "list_relations",
    "Returns a filtered list of relations. Optionally filter by source, target, or relation type.",
    {
      model_id: ModelIdSchema.describe("UUID of the ArchiMate model"),
      token: z.string().describe("Bearer JWT token"),
      source_id: ElementIdSchema.optional().describe("Filter by source element ID"),
      target_id: ElementIdSchema.optional().describe("Filter by target element ID"),
      type: RelationTypeSchema.optional().describe("Filter by relation type"),
    },
    async ({ model_id, token, source_id, target_id, type }) => {
      try {
        const { model } = await loadModel(token, model_id);
        return toolOk(listRelations(model, {
          source_id,
          target_id,
          type: type as ArchiMateRelationType | undefined,
        }));
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // 5. get_relation
  server.tool(
    "get_relation",
    "Returns the full details of a single relation by ID.",
    {
      model_id: ModelIdSchema.describe("UUID of the ArchiMate model"),
      token: z.string().describe("Bearer JWT token"),
      relation_id: RelationIdSchema.describe("ID of the relation"),
    },
    async ({ model_id, token, relation_id }) => {
      try {
        const { model } = await loadModel(token, model_id);
        const relation = getRelation(model, relation_id);
        if (!relation) return toolError(`Relation ${relation_id} not found`);
        return toolOk(relation);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // 6. list_views
  server.tool(
    "list_views",
    "Returns all views/viewpoints in the model with their element and relation IDs.",
    {
      model_id: ModelIdSchema.describe("UUID of the ArchiMate model"),
      token: z.string().describe("Bearer JWT token"),
    },
    async ({ model_id, token }) => {
      try {
        const { model } = await loadModel(token, model_id);
        return toolOk(listViews(model));
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // 7. get_view
  server.tool(
    "get_view",
    "Returns a view with all its elements and relations fully resolved.",
    {
      model_id: ModelIdSchema.describe("UUID of the ArchiMate model"),
      token: z.string().describe("Bearer JWT token"),
      view_id: ViewIdSchema.describe("ID of the view"),
    },
    async ({ model_id, token, view_id }) => {
      try {
        const { model } = await loadModel(token, model_id);
        const result = getView(model, view_id);
        if (!result) return toolError(`View ${view_id} not found`);
        return toolOk(result);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // 8. find_path
  server.tool(
    "find_path",
    "Finds the shortest path between two elements using BFS on all relation types (undirected).",
    {
      model_id: ModelIdSchema.describe("UUID of the ArchiMate model"),
      token: z.string().describe("Bearer JWT token"),
      from_id: ElementIdSchema.describe("Starting element ID"),
      to_id: ElementIdSchema.describe("Target element ID"),
    },
    async ({ model_id, token, from_id, to_id }) => {
      try {
        const { model } = await loadModel(token, model_id);
        return toolOk(findPathTool(model, from_id, to_id));
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // -----------------------------------------------------------------------
  // WRITE TOOLS
  // -----------------------------------------------------------------------

  // 9. add_element
  server.tool(
    "add_element",
    "Adds a new element to the model and returns the new element with its generated ID.",
    {
      model_id: ModelIdSchema.describe("UUID of the ArchiMate model"),
      token: z.string().describe("Bearer JWT token"),
      layer: LayerSchema.describe("ArchiMate layer for the element"),
      type: z.string().describe("Element type (e.g. BusinessActor, ApplicationComponent)"),
      name: z.string().describe("Display name of the element"),
      properties: z.array(PropertySchema).optional().describe("Optional key-value properties"),
      documentation: z.string().optional().describe("Optional documentation text"),
    },
    async ({ model_id, token, layer, type, name, properties, documentation }) => {
      const outcome = await writeModel(token, model_id, (model) => {
        const { model: m, element } = addElementTool(model, {
          type: type as ArchiMateElementType,
          name,
          properties,
          documentation,
        });
        return { model: m, result: element };
      });
      if ("error" in outcome) return toolError(outcome.error);
      return toolOk({ element: outcome.result, version: outcome.version });
    },
  );

  // 10. update_element
  server.tool(
    "update_element",
    "Partially updates an existing element. Only supply the fields you want to change.",
    {
      model_id: ModelIdSchema.describe("UUID of the ArchiMate model"),
      token: z.string().describe("Bearer JWT token"),
      element_id: ElementIdSchema.describe("ID of the element to update"),
      changes: z.object({
        name: z.string().optional(),
        type: z.string().optional(),
        layer: LayerSchema.optional(),
        documentation: z.string().optional(),
        properties: z.array(PropertySchema).optional(),
      }).describe("Fields to update"),
    },
    async ({ model_id, token, element_id, changes }) => {
      const outcome = await writeModel(token, model_id, (model) => {
        const { model: m, updated } = updateElementTool(model, element_id, {
          ...(changes.name !== undefined ? { name: changes.name } : {}),
          ...(changes.type !== undefined ? { type: changes.type as ArchiMateElementType } : {}),
          ...(changes.layer !== undefined ? { layer: changes.layer as ArchiMateLayer } : {}),
          ...(changes.documentation !== undefined ? { documentation: changes.documentation } : {}),
          ...(changes.properties !== undefined ? { properties: changes.properties } : {}),
        });
        return { model: m, result: updated };
      });
      if ("error" in outcome) return toolError(outcome.error);
      if (!outcome.result) return toolError(`Element ${element_id} not found`);
      return toolOk({ element: outcome.result, version: outcome.version });
    },
  );

  // 11. remove_element
  server.tool(
    "remove_element",
    "Removes an element from the model. If cascade=true, also removes all relations touching this element.",
    {
      model_id: ModelIdSchema.describe("UUID of the ArchiMate model"),
      token: z.string().describe("Bearer JWT token"),
      element_id: ElementIdSchema.describe("ID of the element to remove"),
      cascade: z.boolean().optional().default(false).describe("Remove connected relations as well"),
    },
    async ({ model_id, token, element_id, cascade }) => {
      const outcome = await writeModel(token, model_id, (model) => {
        const m = removeElementTool(model, element_id, cascade);
        return { model: m, result: { removed: element_id } };
      });
      if ("error" in outcome) return toolError(outcome.error);
      return toolOk({ ...outcome.result, version: outcome.version });
    },
  );

  // 12. add_relation
  server.tool(
    "add_relation",
    "Adds a new relation between two elements.",
    {
      model_id: ModelIdSchema.describe("UUID of the ArchiMate model"),
      token: z.string().describe("Bearer JWT token"),
      type: RelationTypeSchema.describe("ArchiMate relation type"),
      source_id: ElementIdSchema.describe("ID of the source element"),
      target_id: ElementIdSchema.describe("ID of the target element"),
      name: z.string().optional().describe("Optional display name for the relation"),
      properties: z.array(PropertySchema).optional().describe("Optional properties"),
    },
    async ({ model_id, token, type, source_id, target_id, name, properties }) => {
      const outcome = await writeModel(token, model_id, (model) => {
        const { model: m, relation } = addRelationTool(model, {
          type: type as ArchiMateRelationType,
          source_id,
          target_id,
          name,
          properties,
        });
        return { model: m, result: relation };
      });
      if ("error" in outcome) return toolError(outcome.error);
      return toolOk({ relation: outcome.result, version: outcome.version });
    },
  );

  // 13. remove_relation
  server.tool(
    "remove_relation",
    "Removes a relation from the model and all views that reference it.",
    {
      model_id: ModelIdSchema.describe("UUID of the ArchiMate model"),
      token: z.string().describe("Bearer JWT token"),
      relation_id: RelationIdSchema.describe("ID of the relation to remove"),
    },
    async ({ model_id, token, relation_id }) => {
      const outcome = await writeModel(token, model_id, (model) => {
        const m = removeRelationTool(model, relation_id);
        return { model: m, result: { removed: relation_id } };
      });
      if ("error" in outcome) return toolError(outcome.error);
      return toolOk({ ...outcome.result, version: outcome.version });
    },
  );

  // 14. add_to_view
  server.tool(
    "add_to_view",
    "Adds an element to an existing view.",
    {
      model_id: ModelIdSchema.describe("UUID of the ArchiMate model"),
      token: z.string().describe("Bearer JWT token"),
      view_id: ViewIdSchema.describe("ID of the target view"),
      element_id: ElementIdSchema.describe("ID of the element to add"),
    },
    async ({ model_id, token, view_id, element_id }) => {
      const outcome = await writeModel(token, model_id, (model) => {
        const m = addToViewTool(model, view_id, element_id);
        return { model: m, result: { view_id, element_id } };
      });
      if ("error" in outcome) return toolError(outcome.error);
      return toolOk({ ...outcome.result, version: outcome.version });
    },
  );

  // 15. create_view
  server.tool(
    "create_view",
    "Creates a new empty view/viewpoint in the model.",
    {
      model_id: ModelIdSchema.describe("UUID of the ArchiMate model"),
      token: z.string().describe("Bearer JWT token"),
      name: z.string().describe("Name for the new view"),
      viewpoint_type: z.string().optional().describe("Optional ArchiMate viewpoint type"),
    },
    async ({ model_id, token, name, viewpoint_type }) => {
      const outcome = await writeModel(token, model_id, (model) => {
        const { model: m, view } = createViewTool(
          model,
          name,
          viewpoint_type,
        );
        return { model: m, result: view };
      });
      if ("error" in outcome) return toolError(outcome.error);
      return toolOk({ view: outcome.result, version: outcome.version });
    },
  );
}

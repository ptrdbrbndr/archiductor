/**
 * .archimate file parser (Archi tool native format).
 * This is an XML format used by the Archi tool, closely related to OEF
 * but with a slightly different namespace and structure.
 *
 * Falls back to the OEF parser if the XML appears to be OEF format.
 */

import { XMLParser } from "fast-xml-parser";
import type { ArchiMateElement, ArchiMateElementType, ArchiMateModel, ArchiMateProperty, ArchiMateRelation, ArchiMateRelationType, ArchiMateView } from "../model/types.js";
import { ELEMENT_LAYER } from "../model/types.js";
import { parseOef } from "./oef-parser.js";

const VALID_RELATION_TYPES = new Set<ArchiMateRelationType>([
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

function toRelationType(raw: string): ArchiMateRelationType {
  const normalized = raw
    .replace(/^archimate:/, "")
    .replace(/(-Relationship)?$/i, "");
  if (VALID_RELATION_TYPES.has(normalized as ArchiMateRelationType)) {
    return normalized as ArchiMateRelationType;
  }
  return "Association";
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (tagName) =>
    ["element", "relationship", "folder", "child", "sourceConnection", "property"].includes(tagName),
  allowBooleanAttributes: true,
  parseAttributeValue: false,
  trimValues: true,
});

interface ArchiProperty {
  "@_key": string;
  "@_value": string;
}

interface ArchiElement {
  "@_id": string;
  "@_xsi:type": string;
  "@_name"?: string;
  "@_documentation"?: string;
  property?: ArchiProperty[];
}

interface ArchiChild {
  "@_id": string;
  "@_archimateElement"?: string;
  "@_xsi:type"?: string;
  "@_x"?: string;
  "@_y"?: string;
  "@_width"?: string;
  "@_height"?: string;
  child?: ArchiChild[];
  sourceConnection?: ArchiSourceConnection[];
}

interface ArchiSourceConnection {
  "@_id": string;
  "@_archimateRelationship"?: string;
  "@_xsi:type"?: string;
}

interface ArchiFolder {
  "@_id": string;
  "@_name": string;
  "@_type"?: string;
  element?: ArchiElement[];
  folder?: ArchiFolder[];
  child?: ArchiChild[];
}

interface ArchiDiagramModel {
  "@_id": string;
  "@_name": string;
  "@_xsi:type"?: string;
  "@_viewpoint"?: string;
  child?: ArchiChild[];
}

interface ArchiRoot {
  "archimate:model"?: {
    "@_id"?: string;
    "@_name"?: string;
    folder?: ArchiFolder[];
  };
  "model"?: {
    "@_identifier"?: string;
  };
}

function parseProperties(props?: ArchiProperty[]): ArchiMateProperty[] | undefined {
  if (!props || props.length === 0) return undefined;
  return props.map((p) => ({ key: p["@_key"] ?? "", value: p["@_value"] ?? "" }));
}

function collectElements(folders: ArchiFolder[]): ArchiMateElement[] {
  const elements: ArchiMateElement[] = [];

  function processFolder(folder: ArchiFolder): void {
    for (const el of folder.element ?? []) {
      const rawType = (el["@_xsi:type"] ?? "").replace(/^archimate:/, "") as ArchiMateElementType;
      const props = parseProperties(el.property);
      const layer = ELEMENT_LAYER[rawType] ?? 'business';
      elements.push({
        id: el["@_id"],
        name: el["@_name"] ?? "",
        type: rawType,
        layer,
        ...(el["@_documentation"] ? { documentation: el["@_documentation"] } : {}),
        properties: props ?? [],
      });
    }
    for (const sub of folder.folder ?? []) {
      processFolder(sub);
    }
  }

  for (const folder of folders) {
    processFolder(folder);
  }

  return elements;
}

function collectRelations(folders: ArchiFolder[]): ArchiMateRelation[] {
  // In Archi format, relationships are stored in a folder with type="relations"
  const relations: ArchiMateRelation[] = [];

  function processFolder(folder: ArchiFolder): void {
    if (folder["@_type"] === "relations" || folder["@_name"] === "Relations" || folder["@_name"] === "Relationships") {
      for (const el of folder.element ?? []) {
        const rawType = (el["@_xsi:type"] ?? "").replace(/^archimate:/, "");
        // Relations in Archi are elements with source/target attributes
        // They are stored with xsi:type like "archimate:AssociationRelationship"
        // The element id contains source and target via their properties
        // We skip parsing them here since they require cross-referencing
      }
    }
    for (const sub of folder.folder ?? []) {
      processFolder(sub);
    }
  }

  // Archi stores relationships as elements with special types
  function processAllFolders(folderList: ArchiFolder[]): void {
    for (const folder of folderList) {
      for (const el of folder.element ?? []) {
        const rawType = (el["@_xsi:type"] ?? "").replace(/^archimate:/, "");
        // If it ends in "Relationship", it's a relation
        if (rawType.endsWith("Relationship") || rawType.endsWith("Relation")) {
          const cleanType = rawType
            .replace(/Relationship$/, "")
            .replace(/Relation$/, "");
          const props = parseProperties(el.property);
          const sourceId = props?.find((p) => p.key === "source")?.value;
          const targetId = props?.find((p) => p.key === "target")?.value;
          if (sourceId && targetId) {
            relations.push({
              id: el["@_id"],
              type: toRelationType(cleanType),
              sourceId,
              targetId,
              ...(el["@_name"] ? { name: el["@_name"] } : {}),
              properties: props ?? [],
            });
          }
        }
      }
      processAllFolders(folder.folder ?? []);
    }
  }

  processAllFolders(folders);
  return relations;
}

function collectViews(folders: ArchiFolder[]): ArchiMateView[] {
  const views: ArchiMateView[] = [];

  function collectChildRefs(children: ArchiChild[]): { elementIds: string[]; relationIds: string[] } {
    const elementIds: string[] = [];
    const relationIds: string[] = [];

    function processChild(child: ArchiChild): void {
      if (child["@_archimateElement"]) {
        elementIds.push(child["@_archimateElement"]);
      }
      for (const conn of child.sourceConnection ?? []) {
        if (conn["@_archimateRelationship"]) {
          relationIds.push(conn["@_archimateRelationship"]);
        }
      }
      for (const sub of child.child ?? []) {
        processChild(sub);
      }
    }

    for (const child of children) {
      processChild(child);
    }

    return { elementIds, relationIds };
  }

  function processFolder(folder: ArchiFolder): void {
    // Views are stored as "child" elements within diagram folders
    for (const child of folder.child ?? []) {
      const viewpoint = child["@_xsi:type"]?.replace(/^archimate:/, "") ?? undefined;
      const { elementIds, relationIds } = collectChildRefs(child.child ?? []);
      views.push({
        id: child["@_id"],
        name: "",
        ...(viewpoint ? { viewpoint } : {}),
        elements: elementIds.map(elementId => ({ elementId })),
        relations: relationIds,
      });
    }
    for (const sub of folder.folder ?? []) {
      processFolder(sub);
    }
  }

  for (const folder of folders) {
    processFolder(folder);
  }

  return views;
}

export function parseArchiMate(xml: string): ArchiMateModel {
  // Check if this is actually OEF format
  if (xml.includes("opengroup.org/xsd/archimate")) {
    return parseOef(xml);
  }

  const parsed = xmlParser.parse(xml) as ArchiRoot;
  const raw = parsed["archimate:model"];

  if (!raw) {
    // Try OEF as fallback
    return parseOef(xml);
  }

  const modelId = raw["@_id"] ?? `model-${Date.now()}`;
  const modelName = raw["@_name"] ?? "Unnamed Model";
  const folders = raw.folder ?? [];

  const elementsArray = collectElements(folders);
  const relationsArray = collectRelations(folders);
  const viewsArray = collectViews(folders);

  const elements = new Map(elementsArray.map(el => [el.id, el]));
  const relations = new Map(relationsArray.map(rel => [rel.id, rel]));
  const views = new Map(viewsArray.map(view => [view.id, view]));

  return {
    id: modelId,
    name: modelName,
    elements,
    relations,
    views,
  };
}

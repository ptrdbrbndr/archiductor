/**
 * OEF (ArchiMate Open Exchange Format) XML parser.
 * Parses ArchiMate 3.x OEF XML into an ArchiMateModel.
 *
 * Spec: https://www.opengroup.org/xsd/archimate/3.0/
 */

import { XMLParser } from "fast-xml-parser";
import type { ArchiMateElement, ArchiMateElementType, ArchiMateModel, ArchiMateProperty, ArchiMateRelation, ArchiMateRelationType, ArchiMateView } from "../model/types.js";
import { ELEMENT_LAYER } from "../model/types.js";

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
  // Strip namespace prefix if present, e.g. "Triggering-Relationship" → "Triggering"
  const normalized = raw.replace(/(-Relationship)?$/i, "");
  if (VALID_RELATION_TYPES.has(normalized as ArchiMateRelationType)) {
    return normalized as ArchiMateRelationType;
  }
  return "Association";
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (tagName) =>
    ["element", "relationship", "view", "node", "connection", "property", "propertyDefinition"].includes(tagName),
  allowBooleanAttributes: true,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
});

interface OefProperty {
  // Simple format: <property key="foo" value="bar"/>
  "@_key"?: string;
  "@_value"?: string;
  // OEF 3.x proper format: <property propertyDefinitionRef="propdef-1"><value xml:lang="en">IT</value></property>
  "@_propertyDefinitionRef"?: string;
  value?: string | { "#text": string; "@_xml:lang"?: string } | Array<string | { "#text": string; "@_xml:lang"?: string }>;
}

interface OefPropertyDefinition {
  "@_identifier": string;
  name?: string | { "#text": string; "@_xml:lang"?: string };
}

type OefText = string | { "#text": string; "@_xml:lang"?: string };

interface OefElement {
  "@_identifier": string;
  "@_xsi:type"?: string;
  "@_type"?: string;
  name?: OefText;
  documentation?: OefText;
  properties?: { property?: OefProperty[] };
}

interface OefRelationship {
  "@_identifier": string;
  "@_xsi:type"?: string;
  "@_type"?: string;
  "@_source": string;
  "@_target": string;
  name?: OefText;
  documentation?: OefText;
  properties?: { property?: OefProperty[] };
}

interface OefNode {
  "@_elementRef": string;
  "@_x"?: string;
  "@_y"?: string;
  "@_w"?: string;
  "@_h"?: string;
}

interface OefConnection {
  "@_relationshipRef": string;
}

interface OefView {
  "@_identifier": string;
  "@_xsi:type"?: string;
  "@_viewpointType"?: string;
  name?: OefText;
  node?: OefNode[];
  connection?: OefConnection[];
}

interface OefRoot {
  model: {
    "@_identifier"?: string;
    "@_xmlns"?: string;
    name?: string | { "#text": string; "@_xml:lang"?: string };
    documentation?: string | { "#text": string; "@_xml:lang"?: string };
    elements?: { element?: OefElement[] };
    relationships?: { relationship?: OefRelationship[] };
    views?: { diagrams?: { view?: OefView[] } };
    propertyDefinitions?: { propertyDefinition?: OefPropertyDefinition[] };
  };
}

function extractText(val: string | { "#text": string; [k: string]: string } | undefined): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  return val["#text"] ?? "";
}

function resolvePropertyValue(
  val: OefProperty["value"]
): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (Array.isArray(val)) {
    const first = val[0];
    if (!first) return "";
    if (typeof first === "string") return first;
    return first["#text"] ?? "";
  }
  return val["#text"] ?? "";
}

function parseProperties(
  props?: { property?: OefProperty[] },
  propDefs?: Map<string, string>
): ArchiMateProperty[] | undefined {
  const list = props?.property;
  if (!list || list.length === 0) return undefined;
  return list.map((p) => {
    // OEF 3.x proper: propertyDefinitionRef + <value> child
    if (p["@_propertyDefinitionRef"] && propDefs) {
      const key = propDefs.get(p["@_propertyDefinitionRef"]) ?? p["@_propertyDefinitionRef"];
      const value = resolvePropertyValue(p.value);
      return { key, value };
    }
    // Simple format: key/value attributes
    return { key: p["@_key"] ?? "", value: p["@_value"] ?? "" };
  });
}

function parseElementType(el: OefElement): string {
  return (el["@_xsi:type"] ?? el["@_type"] ?? "Unknown").replace(/^archimate:/, "");
}

function parseRelationType(rel: OefRelationship): string {
  return (rel["@_xsi:type"] ?? rel["@_type"] ?? "Association").replace(/^archimate:/, "");
}

/**
 * Parse OEF XML into an ArchiMateModel.
 *
 * Supports two call signatures:
 *   parseOef(xml)            — model id taken from XML identifier attribute
 *   parseOef(modelId, xml)   — model id overridden by first argument
 */
export function parseOef(xmlOrId: string, xmlContent?: string): ArchiMateModel {
  const xml = xmlContent ?? xmlOrId;
  const parsed = xmlParser.parse(xml) as OefRoot;
  const raw = parsed.model;

  if (!raw) {
    throw new Error("Invalid OEF XML: missing <model> root element");
  }

  // Build propertyDefinitions lookup: identifier → name
  const propDefs = new Map<string, string>();
  for (const def of raw.propertyDefinitions?.propertyDefinition ?? []) {
    const name = extractText(def.name);
    if (name) {
      propDefs.set(def["@_identifier"], name);
    }
  }

  const modelId = xmlContent ? xmlOrId : (raw["@_identifier"] ?? `model-${Date.now()}`);
  const modelName = extractText(raw.name) || "Unnamed Model";
  const modelDoc = extractText(raw.documentation) || undefined;

  // Parse elements
  const elementsArray: ArchiMateElement[] = (raw.elements?.element ?? []).map((el) => {
    const type = parseElementType(el) as ArchiMateElementType;
    const props = parseProperties(el.properties, propDefs);
    const layer = ELEMENT_LAYER[type] ?? 'business';
    return {
      id: el["@_identifier"],
      name: extractText(el.name),
      type,
      layer,
      ...(el.documentation ? { documentation: extractText(el.documentation) } : {}),
      properties: props ?? [],
    };
  });

  // Parse relationships
  const relationsArray: ArchiMateRelation[] = (raw.relationships?.relationship ?? []).map((rel) => {
    const rawType = parseRelationType(rel);
    const props = parseProperties(rel.properties, propDefs);
    return {
      id: rel["@_identifier"],
      type: toRelationType(rawType),
      sourceId: rel["@_source"],
      targetId: rel["@_target"],
      ...(rel.name ? { name: extractText(rel.name) } : {}),
      ...(rel.documentation ? { documentation: extractText(rel.documentation) } : {}),
      properties: props ?? [],
    };
  });

  // Parse views
  const viewsArray: ArchiMateView[] = (raw.views?.diagrams?.view ?? []).map((view) => {
    const nodes = view.node ?? [];
    const conns = view.connection ?? [];
    const elementIds = nodes.map((n) => n["@_elementRef"]).filter(Boolean);
    const relationIds = conns.map((c) => c["@_relationshipRef"]).filter(Boolean);

    return {
      id: view["@_identifier"],
      name: extractText(view.name),
      ...(view["@_viewpointType"] ? { viewpoint: view["@_viewpointType"] } : {}),
      elements: elementIds.map(elementId => ({ elementId })),
      relations: relationIds,
    };
  });

  const elements = new Map(elementsArray.map(el => [el.id, el]));
  const relations = new Map(relationsArray.map(rel => [rel.id, rel]));
  const views = new Map(viewsArray.map(view => [view.id, view]));

  return {
    id: modelId,
    name: modelName,
    ...(modelDoc ? { documentation: modelDoc } : {}),
    elements,
    relations,
    views,
  };
}

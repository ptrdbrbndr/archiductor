/**
 * OEF (ArchiMate Open Exchange Format) XML parser.
 * Parses ArchiMate 3.x OEF XML into an ArchiMateModel.
 *
 * Spec: https://www.opengroup.org/xsd/archimate/3.0/
 */

import { XMLParser } from "fast-xml-parser";
import type { ArchiMateElement, ArchiMateModel, ArchiMateProperty, ArchiMateRelation, ArchiMateRelationType, ArchiMateView } from "../model/types.js";
import { inferLayer } from "../model/types.js";

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
    ["element", "relationship", "view", "node", "connection", "property"].includes(tagName),
  allowBooleanAttributes: true,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
});

interface OefProperty {
  "@_key": string;
  "@_value": string;
}

interface OefElement {
  "@_identifier": string;
  "@_xsi:type"?: string;
  "@_type"?: string;
  name?: string | { "#text": string };
  documentation?: string | { "#text": string };
  properties?: { property?: OefProperty[] };
}

interface OefRelationship {
  "@_identifier": string;
  "@_xsi:type"?: string;
  "@_type"?: string;
  "@_source": string;
  "@_target": string;
  name?: string | { "#text": string };
  documentation?: string | { "#text": string };
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
  name?: string | { "#text": string };
  node?: OefNode[];
  connection?: OefConnection[];
}

interface OefRoot {
  model: {
    "@_identifier"?: string;
    "@_xmlns"?: string;
    name?: string | { "#text": string };
    documentation?: string | { "#text": string };
    elements?: { element?: OefElement[] };
    relationships?: { relationship?: OefRelationship[] };
    views?: { diagrams?: { view?: OefView[] } };
  };
}

function extractText(val: string | { "#text": string } | undefined): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  return val["#text"] ?? "";
}

function parseProperties(props?: { property?: OefProperty[] }): ArchiMateProperty[] | undefined {
  const list = props?.property;
  if (!list || list.length === 0) return undefined;
  return list.map((p) => ({ key: p["@_key"] ?? "", value: p["@_value"] ?? "" }));
}

function parseElementType(el: OefElement): string {
  return (el["@_xsi:type"] ?? el["@_type"] ?? "Unknown").replace(/^archimate:/, "");
}

function parseRelationType(rel: OefRelationship): string {
  return (rel["@_xsi:type"] ?? rel["@_type"] ?? "Association").replace(/^archimate:/, "");
}

export function parseOef(xml: string): ArchiMateModel {
  const parsed = xmlParser.parse(xml) as OefRoot;
  const raw = parsed.model;

  if (!raw) {
    throw new Error("Invalid OEF XML: missing <model> root element");
  }

  const modelId = raw["@_identifier"] ?? `model-${Date.now()}`;
  const modelName = extractText(raw.name) || "Unnamed Model";
  const modelDoc = extractText(raw.documentation) || undefined;

  // Parse elements
  const elements: ArchiMateElement[] = (raw.elements?.element ?? []).map((el) => {
    const type = parseElementType(el);
    const props = parseProperties(el.properties);
    return {
      id: el["@_identifier"],
      name: extractText(el.name),
      type,
      layer: inferLayer(type),
      ...(el.documentation ? { documentation: extractText(el.documentation) } : {}),
      ...(props ? { properties: props } : {}),
    };
  });

  // Parse relationships
  const relations: ArchiMateRelation[] = (raw.relationships?.relationship ?? []).map((rel) => {
    const rawType = parseRelationType(rel);
    const props = parseProperties(rel.properties);
    return {
      id: rel["@_identifier"],
      type: toRelationType(rawType),
      sourceId: rel["@_source"],
      targetId: rel["@_target"],
      ...(rel.name ? { name: extractText(rel.name) } : {}),
      ...(rel.documentation ? { documentation: extractText(rel.documentation) } : {}),
      ...(props ? { properties: props } : {}),
    };
  });

  // Parse views
  const views: ArchiMateView[] = (raw.views?.diagrams?.view ?? []).map((view) => {
    const nodes = view.node ?? [];
    const conns = view.connection ?? [];
    const elementIds = nodes.map((n) => n["@_elementRef"]).filter(Boolean);
    const relationIds = conns.map((c) => c["@_relationshipRef"]).filter(Boolean);

    return {
      id: view["@_identifier"],
      name: extractText(view.name),
      ...(view["@_viewpointType"] ? { viewpointType: view["@_viewpointType"] } : {}),
      elementIds,
      relationIds,
      nodes: nodes.map((n) => ({
        elementId: n["@_elementRef"],
        ...(n["@_x"] ? { x: Number(n["@_x"]) } : {}),
        ...(n["@_y"] ? { y: Number(n["@_y"]) } : {}),
        ...(n["@_w"] ? { w: Number(n["@_w"]) } : {}),
        ...(n["@_h"] ? { h: Number(n["@_h"]) } : {}),
      })),
      connections: conns.map((c) => ({ relationId: c["@_relationshipRef"] })),
    };
  });

  return {
    id: modelId,
    name: modelName,
    ...(modelDoc ? { documentation: modelDoc } : {}),
    elements,
    relations,
    views,
  };
}

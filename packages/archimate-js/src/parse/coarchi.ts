/**
 * CoArchi-format parser — leest een uitgepakte CoArchi-folder-tree en
 * produceert een ArchiModel.
 *
 * CoArchi is de git-plugin van Archi (https://github.com/archimatetool/archi-modelrepository-plugin).
 * Het splitst Archi's interne `.archimate` XML-bestand op in losse XML-files
 * per element/relatie/view, zodat git-diffs zinvol blijven.
 *
 * **Belangrijk**: CoArchi gebruikt Archi's interne XML-dialect (archimate:
 * namespace + Archi-element-typen zoals `archimate:BusinessProcess`), NIET
 * de Open Exchange Format. Dit is dus een aparte codepath dan parseOpenExchange.
 *
 * **Folder-layout** (zoals waargenomen in Archi-coarchi 0.10+):
 *
 *   model.xml                        — manifest met model-naam, id
 *   business/<elementId>.xml         — één Business-layer element per file
 *   application/<elementId>.xml      — Application-layer
 *   technology/<elementId>.xml       — Technology-layer
 *   motivation/<elementId>.xml       — Motivation-layer
 *   strategy/<elementId>.xml         — Strategy-layer
 *   implementation_migration/<id>.xml — Implementation-layer
 *   other/<elementId>.xml            — verzamel-laag (varies)
 *   relations/<relationshipId>.xml   — alle relaties
 *   diagrams/<viewId>.xml            — views (ArchimateDiagramModel)
 *   folder.xml                       — per folder een manifest (genegeerd)
 *
 * Heuristiek voor onbekende layouts: we walken ALLE *.xml files en
 * classificeren op de XML-root:
 *   - <archimate:model ...> → manifest, sla over
 *   - <archimate:ArchimateDiagramModel ...> → view
 *   - <archimate:X*Relationship ...> → relationship
 *   - andere <archimate:* ...> → element
 *
 * Resultaat-schema: zelfde ArchiModel als OEF-parser produceert.
 */

import { XMLParser } from "fast-xml-parser";

import { detectLayer } from "../archimate-layers.js";
import type {
  ArchiElement,
  ArchiModel,
  ArchiRelationship,
  ArchiRelationshipType,
  ArchiView,
  ArchiViewConnection,
  ArchiViewNode,
} from "../types.js";

/** Map van bestandspad (POSIX, relatief tot repo-root) naar inhoud. */
export type CoArchiFileMap = Record<string, string>;

interface CoArchiParseOptions {
  /** Negeer files boven deze grootte (in bytes). Default: 5 MB per file. */
  maxFileSize?: number;
}

const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024;

const RELATIONSHIP_TYPES: readonly ArchiRelationshipType[] = [
  "Composition",
  "Aggregation",
  "Assignment",
  "Realization",
  "Triggering",
  "Flow",
  "Influence",
  "Access",
  "UsedBy",
  "Specialization",
  "Association",
];

const RELATIONSHIP_SET = new Set<string>(RELATIONSHIP_TYPES);

/**
 * fast-xml-parser node-shape met `preserveOrder: true` + `@_`-prefix-attrs:
 *
 *   { "tagname": [<child nodes>], ":@": { "@_attr": "value", ... } }
 *
 * Children van text-only zijn arrays met één entry: `{ "#text": "..." }`.
 */
interface XmlNode {
  [key: string]: unknown;
  ":@"?: Record<string, string | number>;
}

export function parseCoArchi(
  files: CoArchiFileMap,
  options: CoArchiParseOptions = {},
): ArchiModel {
  const maxSize = options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    preserveOrder: true,
    parseAttributeValue: false,
    trimValues: true,
  });

  let modelName: string | undefined;
  const elements: ArchiElement[] = [];
  const relationships: ArchiRelationship[] = [];
  const views: ArchiView[] = [];

  const paths = Object.keys(files)
    .filter((p) => p.toLowerCase().endsWith(".xml"))
    .sort();

  for (const path of paths) {
    const content = files[path];
    if (!content) continue;
    if (content.length > maxSize) continue;

    const baseName = posixBaseName(path).toLowerCase();
    if (baseName === "folder.xml") continue;

    let parsedRaw: unknown;
    try {
      parsedRaw = parser.parse(content);
    } catch {
      continue;
    }
    if (!Array.isArray(parsedRaw)) continue;

    const root = findRoot(parsedRaw as XmlNode[]);
    if (!root) continue;

    const tag = tagName(root);
    if (!tag) continue;
    const attrs = root[":@"] ?? {};

    if (tag === "archimate:model") {
      const n = stringAttr(attrs, "@_name");
      if (n) modelName = n;
      continue;
    }

    if (tag === "archimate:ArchimateDiagramModel") {
      const view = parseView(root, attrs);
      if (view) views.push(view);
      continue;
    }

    if (!tag.startsWith("archimate:")) continue;
    const archimateType = tag.slice("archimate:".length);

    if (archimateType === "folder") continue;

    if (
      archimateType.endsWith("Relationship") &&
      RELATIONSHIP_SET.has(stripRelationshipSuffix(archimateType))
    ) {
      const rel = parseRelationship(archimateType, attrs, getDocumentation(root));
      if (rel) relationships.push(rel);
      continue;
    }

    const element = parseElement(archimateType, attrs, root);
    if (element) elements.push(element);
  }

  if (elements.length === 0 && views.length === 0) {
    throw new Error(
      "Geen CoArchi-elementen of -views gevonden. Is dit een CoArchi-repo?",
    );
  }

  if (views.length === 0) {
    views.push(synthDefaultView(elements));
  }

  return {
    version: "archimate-4.0",
    name: modelName ?? "CoArchi import",
    elements,
    relationships,
    views,
  };
}

function parseElement(
  archimateType: string,
  attrs: Record<string, string | number>,
  root: XmlNode,
): ArchiElement | null {
  const id = stringAttr(attrs, "@_id");
  if (!id) return null;

  return {
    id,
    name: stringAttr(attrs, "@_name") ?? archimateType,
    type: archimateType,
    layer: detectLayer(archimateType),
    documentation: getDocumentation(root) || undefined,
    properties: collectProperties(root),
  };
}

function parseRelationship(
  archimateType: string,
  attrs: Record<string, string | number>,
  documentation: string | undefined,
): ArchiRelationship | null {
  const id = stringAttr(attrs, "@_id");
  const source = stringAttr(attrs, "@_source");
  const target = stringAttr(attrs, "@_target");
  if (!id || !source || !target) return null;

  const type = stripRelationshipSuffix(archimateType) as ArchiRelationshipType;

  return {
    id,
    type,
    source,
    target,
    name: stringAttr(attrs, "@_name"),
    documentation: documentation || undefined,
  };
}

function parseView(
  root: XmlNode,
  attrs: Record<string, string | number>,
): ArchiView | null {
  const id = stringAttr(attrs, "@_id");
  if (!id) return null;

  const children = directChildrenByTag(root, "child");
  const nodes: ArchiViewNode[] = [];
  for (const c of children) {
    const cAttrs = c[":@"] ?? {};
    const nodeId = stringAttr(cAttrs, "@_id");
    const elementRef = stringAttr(cAttrs, "@_archimateElement");
    if (!nodeId || !elementRef) continue;
    nodes.push({
      id: nodeId,
      elementRef,
      x: numAttr(cAttrs, "@_x") ?? 0,
      y: numAttr(cAttrs, "@_y") ?? 0,
      width: numAttr(cAttrs, "@_width") ?? 120,
      height: numAttr(cAttrs, "@_height") ?? 60,
    });
  }

  const conns: ArchiViewConnection[] = [];

  // Top-level sourceConnections
  for (const sc of directChildrenByTag(root, "sourceConnection")) {
    const conn = parseConn(sc);
    if (conn) conns.push(conn);
  }

  // Geneste sourceConnections in child-nodes (Archi rendert ze meestal hier)
  for (const c of children) {
    for (const sc of directChildrenByTag(c, "sourceConnection")) {
      const conn = parseConn(sc);
      if (conn) conns.push(conn);
    }
  }

  return {
    id,
    name: stringAttr(attrs, "@_name") ?? "Diagram",
    nodes,
    connections: conns,
  };
}

function parseConn(scNode: XmlNode): ArchiViewConnection | null {
  const scAttrs = scNode[":@"] ?? {};
  const connId = stringAttr(scAttrs, "@_id");
  const sourceNodeRef = stringAttr(scAttrs, "@_source");
  const targetNodeRef = stringAttr(scAttrs, "@_target");
  const relationshipRef = stringAttr(scAttrs, "@_archimateRelationship");
  if (!connId || !sourceNodeRef || !targetNodeRef || !relationshipRef) {
    return null;
  }
  return {
    id: connId,
    relationshipRef,
    sourceNodeRef,
    targetNodeRef,
    bendpoints: [],
  };
}

function synthDefaultView(elements: ArchiElement[]): ArchiView {
  const PER_ROW = 5;
  const W = 140;
  const H = 60;
  const GAP = 30;
  const nodes: ArchiViewNode[] = elements.map((e, i) => ({
    id: `auto-node-${e.id}`,
    elementRef: e.id,
    x: (i % PER_ROW) * (W + GAP),
    y: Math.floor(i / PER_ROW) * (H + GAP),
    width: W,
    height: H,
  }));
  return {
    id: "auto-view-1",
    name: "Alle elementen",
    nodes,
    connections: [],
  };
}

function stripRelationshipSuffix(type: string): string {
  return type.endsWith("Relationship")
    ? type.slice(0, -"Relationship".length)
    : type;
}

function tagName(node: XmlNode): string | undefined {
  for (const key of Object.keys(node)) {
    if (key !== ":@" && key !== "?xml") return key;
  }
  return undefined;
}

function findRoot(nodes: XmlNode[]): XmlNode | undefined {
  for (const n of nodes) {
    const tag = tagName(n);
    if (tag && tag !== "?xml") return n;
  }
  return undefined;
}

function stringAttr(
  attrs: Record<string, string | number>,
  key: string,
): string | undefined {
  const v = attrs[key];
  if (v === undefined || v === null) return undefined;
  return String(v);
}

function numAttr(
  attrs: Record<string, string | number>,
  key: string,
): number | undefined {
  const v = attrs[key];
  if (v === undefined || v === null) return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Vind alle directe-kinderen XML-nodes met de gegeven tag.
 *
 * `root["tagname"]` is een array waarin elke entry een child-node is van
 * een eigen tag — dus we moeten alle entries afgaan en kijken welke key
 * (anders dan `:@`) ze hebben.
 */
function directChildrenByTag(node: XmlNode, tag: string): XmlNode[] {
  const out: XmlNode[] = [];
  const childrenKey = tagName(node);
  if (!childrenKey) return out;
  const childList = node[childrenKey];
  if (!Array.isArray(childList)) return out;
  for (const child of childList as XmlNode[]) {
    if (tagName(child) === tag) out.push(child);
  }
  return out;
}

function getDocumentation(root: XmlNode): string | undefined {
  for (const doc of directChildrenByTag(root, "documentation")) {
    const inner = doc["documentation"];
    if (Array.isArray(inner) && inner.length > 0) {
      const text = (inner[0] as { "#text"?: string })["#text"];
      if (typeof text === "string") return text;
    }
  }
  return undefined;
}

function collectProperties(root: XmlNode): Record<string, string> | undefined {
  const props: Record<string, string> = {};
  for (const p of directChildrenByTag(root, "property")) {
    const pAttrs = p[":@"] ?? {};
    const pKey = stringAttr(pAttrs, "@_key");
    const pVal = stringAttr(pAttrs, "@_value");
    if (pKey && pVal !== undefined) props[pKey] = pVal;
  }
  return Object.keys(props).length > 0 ? props : undefined;
}

function posixBaseName(p: string): string {
  const idx = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return idx === -1 ? p : p.slice(idx + 1);
}

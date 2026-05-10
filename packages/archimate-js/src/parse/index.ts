/**
 * Open Exchange Format (OEF) parser + serializer.
 *
 * OEF is de officiële, gecertificeerde interop-standaard voor ArchiMate sinds
 * juni 2018 (verplicht voor gecertificeerde tools — Archi, Modelio, Sparx,
 * BiZZdesign).
 *
 * - Bestandsextensie: `.xml`
 * - Spec: <https://pubs.opengroup.org/architecture/archimate4-doc/exchange-format/>
 *
 * M1 doel: round-trip groen op 20 referentiemodellen uit Open Group +
 * OpenExchange-corpus. M1-week-1 status: 4.0 basis-parser + serializer voor
 * elements/relationships/views/nodes/connections. Properties + multilingue +
 * organizations volgen in M1-week-2.
 */

import { XMLBuilder, XMLParser } from "fast-xml-parser";

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

const ARRAY_NODES = new Set([
  "element",
  "relationship",
  "view",
  "node",
  "connection",
  "bendpoint",
  "property",
]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) => ARRAY_NODES.has(name),
});

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  format: true,
  indentBy: "  ",
  suppressEmptyNode: true,
});

interface ParserRecord {
  [key: string]: unknown;
}

function asRecord(value: unknown): ParserRecord {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as ParserRecord;
  }
  return {};
}

function getString(record: ParserRecord, key: string): string | undefined {
  const v = record[key];
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return undefined;
}

function getNumber(record: ParserRecord, key: string): number {
  const v = record[key];
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

/**
 * Pakt tekst-content uit een element dat ofwel een string is (eenvoudige tag),
 * ofwel een object met `#text` (tag met attributen, bv. `<name xml:lang="nl">..</name>`),
 * ofwel een array (multilingue — pakt de eerste).
 */
function textOf(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return undefined;
    return textOf(value[0]);
  }
  if (typeof value === "object") {
    const r = value as ParserRecord;
    const text = r["#text"];
    if (typeof text === "string") return text;
    if (typeof text === "number") return String(text);
  }
  return undefined;
}

function parseElement(raw: unknown): ArchiElement | null {
  const r = asRecord(raw);
  const id = getString(r, "@_identifier");
  if (!id) return null;
  const type = getString(r, "@_type") ?? "BusinessProcess";
  return {
    id,
    name: textOf(r.name) ?? id,
    type,
    layer: detectLayer(type),
    documentation: textOf(r.documentation),
  };
}

function parseRelationship(raw: unknown): ArchiRelationship | null {
  const r = asRecord(raw);
  const id = getString(r, "@_identifier");
  const source = getString(r, "@_source");
  const target = getString(r, "@_target");
  if (!id || !source || !target) return null;
  const rawType = getString(r, "@_type") ?? "Association";
  const type = RELATIONSHIP_TYPES.includes(rawType as ArchiRelationshipType)
    ? (rawType as ArchiRelationshipType)
    : "Association";
  return {
    id,
    type,
    source,
    target,
    name: textOf(r.name),
    documentation: textOf(r.documentation),
  };
}

function parseViewNode(raw: unknown): ArchiViewNode | null {
  const r = asRecord(raw);
  const id = getString(r, "@_identifier");
  const elementRef = getString(r, "@_elementRef");
  if (!id || !elementRef) return null;
  return {
    id,
    elementRef,
    x: getNumber(r, "@_x"),
    y: getNumber(r, "@_y"),
    width: getNumber(r, "@_w"),
    height: getNumber(r, "@_h"),
  };
}

function parseViewConnection(raw: unknown): ArchiViewConnection | null {
  const r = asRecord(raw);
  const id = getString(r, "@_identifier");
  const relationshipRef = getString(r, "@_relationshipRef");
  const sourceNodeRef = getString(r, "@_source");
  const targetNodeRef = getString(r, "@_target");
  if (!id || !relationshipRef || !sourceNodeRef || !targetNodeRef) return null;
  const bendpoints: { x: number; y: number }[] = [];
  const rawBendpoints = r.bendpoint;
  if (Array.isArray(rawBendpoints)) {
    for (const bp of rawBendpoints) {
      const br = asRecord(bp);
      bendpoints.push({ x: getNumber(br, "@_x"), y: getNumber(br, "@_y") });
    }
  }
  return { id, relationshipRef, sourceNodeRef, targetNodeRef, bendpoints };
}

function parseView(raw: unknown): ArchiView | null {
  const r = asRecord(raw);
  const id = getString(r, "@_identifier");
  if (!id) return null;
  const rawNodes = Array.isArray(r.node) ? r.node : [];
  const rawConns = Array.isArray(r.connection) ? r.connection : [];
  return {
    id,
    name: textOf(r.name) ?? id,
    viewpoint: getString(r, "@_viewpoint"),
    nodes: rawNodes
      .map(parseViewNode)
      .filter((n): n is ArchiViewNode => n !== null),
    connections: rawConns
      .map(parseViewConnection)
      .filter((c): c is ArchiViewConnection => c !== null),
  };
}

/**
 * Parse OEF XML naar in-memory ArchiModel.
 *
 * Werkt voor ArchiMate 3.2 en 4.0 OEF — namespace wordt gestript via
 * `removeNSPrefix: true` zodat structurele parsing identiek is.
 */
export function parseOpenExchange(xml: string): ArchiModel {
  const raw = parser.parse(xml) as ParserRecord;
  const modelRaw = asRecord(raw.model);

  // Detect OEF spec-version uit de raw XML — sommige parser-configs strippen
  // de default xmlns-attribute, dus regex tegen de source is robuuster.
  const nsMatch = /xmlns\s*=\s*"[^"]*archimate\/(\d+)\.\d+/.exec(xml);
  const version: "archimate-3.2" | "archimate-4.0" =
    nsMatch?.[1] === "3" ? "archimate-3.2" : "archimate-4.0";

  const elementsContainer = asRecord(modelRaw.elements);
  const elementsRaw = Array.isArray(elementsContainer.element)
    ? elementsContainer.element
    : [];

  const relationshipsContainer = asRecord(modelRaw.relationships);
  const relationshipsRaw = Array.isArray(relationshipsContainer.relationship)
    ? relationshipsContainer.relationship
    : [];

  // OEF 4.0 nest views onder <views><diagrams><view/></diagrams></views>;
  // 3.x heeft <views><view/></views>. Beide ondersteunen.
  const viewsContainer = asRecord(modelRaw.views);
  let viewsRaw: unknown[] = [];
  if (Array.isArray(viewsContainer.view)) {
    viewsRaw = viewsContainer.view;
  } else if (viewsContainer.diagrams !== undefined) {
    const diagrams = asRecord(viewsContainer.diagrams);
    if (Array.isArray(diagrams.view)) viewsRaw = diagrams.view;
  }

  return {
    version,
    name: textOf(modelRaw.name) ?? getString(modelRaw, "@_identifier") ?? "",
    documentation: textOf(modelRaw.documentation),
    elements: elementsRaw
      .map(parseElement)
      .filter((e): e is ArchiElement => e !== null),
    relationships: relationshipsRaw
      .map(parseRelationship)
      .filter((r): r is ArchiRelationship => r !== null),
    views: viewsRaw.map(parseView).filter((v): v is ArchiView => v !== null),
  };
}

/**
 * Serialize ArchiModel naar OEF XML.
 *
 * Schrijft naar OEF 4.0 ongeacht model.version (3.2-content blijft semantisch
 * geldig in 4.0; migratie-laag komt in M6 als afzonderlijke module).
 */
export function serializeOpenExchange(model: ArchiModel): string {
  const xmlns =
    model.version === "archimate-3.2"
      ? "http://www.opengroup.org/xsd/archimate/3.0/"
      : "http://www.opengroup.org/xsd/archimate/4.0/";

  const obj = {
    "?xml": { "@_version": "1.0", "@_encoding": "UTF-8" },
    model: {
      "@_xmlns": xmlns,
      "@_xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
      "@_identifier": `id-${slug(model.name)}`,
      name: { "@_xml:lang": "nl", "#text": model.name },
      ...(model.documentation !== undefined
        ? { documentation: { "@_xml:lang": "nl", "#text": model.documentation } }
        : {}),
      elements: {
        element: model.elements.map((e) => ({
          "@_identifier": e.id,
          "@_xsi:type": e.type,
          name: { "@_xml:lang": "nl", "#text": e.name },
          ...(e.documentation !== undefined
            ? { documentation: { "@_xml:lang": "nl", "#text": e.documentation } }
            : {}),
        })),
      },
      ...(model.relationships.length > 0
        ? {
            relationships: {
              relationship: model.relationships.map((r) => ({
                "@_identifier": r.id,
                "@_source": r.source,
                "@_target": r.target,
                "@_xsi:type": r.type,
                ...(r.name !== undefined
                  ? { name: { "@_xml:lang": "nl", "#text": r.name } }
                  : {}),
              })),
            },
          }
        : {}),
      ...(model.views.length > 0
        ? {
            views: {
              diagrams: {
                view: model.views.map((v) => ({
                  "@_identifier": v.id,
                  "@_xsi:type": "Diagram",
                  name: { "@_xml:lang": "nl", "#text": v.name },
                  node: v.nodes.map((n) => ({
                    "@_identifier": n.id,
                    "@_elementRef": n.elementRef,
                    "@_x": n.x,
                    "@_y": n.y,
                    "@_w": n.width,
                    "@_h": n.height,
                    "@_xsi:type": "Element",
                  })),
                  connection: v.connections.map((c) => ({
                    "@_identifier": c.id,
                    "@_relationshipRef": c.relationshipRef,
                    "@_source": c.sourceNodeRef,
                    "@_target": c.targetNodeRef,
                    "@_xsi:type": "Relationship",
                    ...(c.bendpoints.length > 0
                      ? {
                          bendpoint: c.bendpoints.map((bp) => ({
                            "@_x": bp.x,
                            "@_y": bp.y,
                          })),
                        }
                      : {}),
                  })),
                })),
              },
            },
          }
        : {}),
    },
  };

  return builder.build(obj) as string;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

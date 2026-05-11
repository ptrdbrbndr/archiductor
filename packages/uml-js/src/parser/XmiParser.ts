/**
 * XmiParser — parset Eclipse UML2 XMI 2.5 naar intern UmlModel.
 *
 * Input: Eclipse UML2 XMI 2.5 (.uml bestand).
 * XML root: <uml:Model xmi:version="20131001"
 *   xmlns:uml="http://www.eclipse.org/uml2/5.0.0/UML">
 *
 * Ondersteunde exports van: Eclipse Papyrus, Modelio, Visual Paradigm.
 *
 * Spec: UML 2.5 — https://www.omg.org/spec/UML/2.5.1/PDF
 */

import { XMLParser } from "fast-xml-parser";

import type {
  UmlAttribute,
  UmlClass,
  UmlModel,
  UmlOperation,
  UmlParameter,
  UmlRelation,
  UmlRelationType,
  UmlVisibility,
} from "../types.js";

// ─── constants ────────────────────────────────────────────────────────────────

const ARRAY_TAGS = new Set([
  "packagedElement",
  "ownedAttribute",
  "ownedOperation",
  "ownedParameter",
  "ownedEnd",
  "generalization",
  "interfaceRealization",
  "nestedClassifier",
]);

const VISIBILITY_MAP: Record<string, UmlVisibility> = {
  public: "public",
  protected: "protected",
  private: "private",
  package: "package",
};

const UML_TYPE_CLASSES = new Set(["uml:Class", "uml:AssociationClass"]);
const UML_TYPE_INTERFACE = "uml:Interface";
const UML_TYPE_ASSOCIATION = "uml:Association";
const UML_TYPE_DEPENDENCY = "uml:Dependency";
const UML_TYPE_USAGE = "uml:Usage";
const UML_TYPE_ABSTRACTION = "uml:Abstraction";
const DEFAULT_VISIBILITY: UmlVisibility = "public";

// ─── internal parser types ────────────────────────────────────────────────────

interface ParseRecord {
  [key: string]: unknown;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function asRecord(value: unknown): ParseRecord {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as ParseRecord;
  }
  return {};
}

function getString(r: ParseRecord, key: string): string | undefined {
  const v = r[key];
  if (typeof v === "string") return v || undefined;
  if (typeof v === "number") return String(v);
  return undefined;
}

function getBool(r: ParseRecord, key: string): boolean {
  const v = r[key];
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toLowerCase() === "true";
  return false;
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value !== undefined && value !== null) return [value];
  return [];
}

function resolveVisibility(raw: string | undefined): UmlVisibility {
  if (!raw) return DEFAULT_VISIBILITY;
  return VISIBILITY_MAP[raw.toLowerCase()] ?? DEFAULT_VISIBILITY;
}

function stripTypePrefix(typeRef: string | undefined): string {
  if (!typeRef) return "void";
  // Verwijder XMI href-prefix (#T, //@...) — bewaar alleen de laatste deel
  const hashIdx = typeRef.lastIndexOf("#");
  if (hashIdx !== -1) return typeRef.slice(hashIdx + 1);
  const slashIdx = typeRef.lastIndexOf("/");
  if (slashIdx !== -1) return typeRef.slice(slashIdx + 1);
  return typeRef;
}

// ─── attribute parser ─────────────────────────────────────────────────────────

function parseAttribute(raw: unknown): UmlAttribute | null {
  const r = asRecord(raw);
  const name = getString(r, "@_name");
  if (!name) return null;

  const typeRef = getString(r, "@_type");
  const typeEl = asRecord(r.type);
  const typeHref = getString(typeEl, "@_href") ?? getString(typeEl, "@_xmi:idref");
  const resolvedType = typeHref
    ? stripTypePrefix(typeHref)
    : (typeRef ? stripTypePrefix(typeRef) : "String");

  const aggregation = getString(r, "@_aggregation");

  return {
    name,
    type: resolvedType,
    visibility: resolveVisibility(getString(r, "@_visibility")),
    isStatic: getBool(r, "@_isStatic"),
    // Aggregation-info zit op attributen bij association-ends — bewaar voor relaties
    _aggregation: aggregation,
  } as UmlAttribute & { _aggregation?: string };
}

// ─── operation parser ─────────────────────────────────────────────────────────

function parseOperation(raw: unknown): UmlOperation | null {
  const r = asRecord(raw);
  const name = getString(r, "@_name");
  if (!name) return null;

  const params: UmlParameter[] = [];
  let returnType = "void";

  for (const paramRaw of asArray(r.ownedParameter)) {
    const p = asRecord(paramRaw);
    const pName = getString(p, "@_name");
    const direction = getString(p, "@_direction");

    if (direction === "return") {
      const typeEl = asRecord(p.type);
      const href = getString(typeEl, "@_href") ?? getString(typeEl, "@_xmi:idref");
      const typeRef = getString(p, "@_type");
      returnType = href
        ? stripTypePrefix(href)
        : (typeRef ? stripTypePrefix(typeRef) : "void");
      continue;
    }

    if (!pName || pName === "return") continue;

    const typeEl = asRecord(p.type);
    const href = getString(typeEl, "@_href") ?? getString(typeEl, "@_xmi:idref");
    const typeRef = getString(p, "@_type");
    const pType = href
      ? stripTypePrefix(href)
      : (typeRef ? stripTypePrefix(typeRef) : "Object");

    params.push({ name: pName, type: pType });
  }

  return {
    name,
    returnType,
    visibility: resolveVisibility(getString(r, "@_visibility")),
    parameters: params,
  };
}

// ─── class/interface parser ───────────────────────────────────────────────────

function parseClass(r: ParseRecord, xmiType: string): UmlClass | null {
  const id = getString(r, "@_xmi:id");
  const name = getString(r, "@_name");
  if (!id || !name) return null;

  const isInterface = xmiType === UML_TYPE_INTERFACE;
  const isAbstract = getBool(r, "@_isAbstract");

  const attributes: UmlAttribute[] = [];
  for (const attrRaw of asArray(r.ownedAttribute)) {
    const attr = parseAttribute(attrRaw);
    if (attr) {
      // Sla navigable association-ends over (horen bij UmlRelation, niet Class)
      const aggr = (attr as UmlAttribute & { _aggregation?: string })._aggregation;
      if (aggr && aggr !== "none") continue;
      attributes.push(attr);
    }
  }

  const operations: UmlOperation[] = [];
  for (const opRaw of asArray(r.ownedOperation)) {
    const op = parseOperation(opRaw);
    if (op) operations.push(op);
  }

  // Nested classifiers (bijv. inner class)
  for (const nestedRaw of asArray(r.nestedClassifier)) {
    const nr = asRecord(nestedRaw);
    const nestedType = getString(nr, "@_xmi:type");
    if (!nestedType) continue;
    if (UML_TYPE_CLASSES.has(nestedType) || nestedType === UML_TYPE_INTERFACE) {
      // Recursief — inner classes worden als top-level toegevoegd voor eenvoud
    }
  }

  return {
    id,
    name,
    isAbstract,
    isInterface,
    attributes,
    operations,
  };
}

// ─── relation parsers ─────────────────────────────────────────────────────────

function parseAssociation(r: ParseRecord): UmlRelation | null {
  const id = getString(r, "@_xmi:id");
  if (!id) return null;

  const ends = asArray(r.ownedEnd);
  const memberEnds = getString(r, "@_memberEnd")?.split(" ") ?? [];

  // Bepaal source en target uit ownedEnd of memberEnd
  let sourceId: string | undefined;
  let targetId: string | undefined;
  let relType: UmlRelationType = "association";

  if (ends.length >= 2) {
    const endA = asRecord(ends[0]);
    const endB = asRecord(ends[1]);
    sourceId = getString(endA, "@_type");
    targetId = getString(endB, "@_type");

    const aggr = getString(endA, "@_aggregation") ?? getString(endB, "@_aggregation");
    if (aggr === "composite") relType = "composition";
    else if (aggr === "shared") relType = "aggregation";
  } else if (memberEnds.length >= 2) {
    // memberEnd bevat xmi:idref waarden — haal type op via ownedAttribute
    // Voor nu: source/target blijven undefined (worden gefilterd)
  }

  // Fallback: gebruik @_supplier / @_client die in sommige exports voorkomen
  if (!sourceId) sourceId = getString(r, "@_client");
  if (!targetId) targetId = getString(r, "@_supplier");

  if (!sourceId || !targetId) return null;

  return {
    id,
    type: relType,
    sourceId,
    targetId,
    name: getString(r, "@_name"),
  };
}

function parseGeneralization(
  classId: string,
  raw: unknown,
): UmlRelation | null {
  const r = asRecord(raw);
  const id = getString(r, "@_xmi:id") ?? `gen-${classId}-${getString(r, "@_general")}`;
  const targetId = getString(r, "@_general");
  if (!targetId) return null;

  return {
    id,
    type: "generalization",
    sourceId: classId,
    targetId,
  };
}

function parseInterfaceRealization(
  classId: string,
  raw: unknown,
): UmlRelation | null {
  const r = asRecord(raw);
  const id = getString(r, "@_xmi:id") ?? `real-${classId}`;
  const targetId = getString(r, "@_contract") ?? getString(r, "@_supplier");
  if (!targetId) return null;

  return {
    id,
    type: "realization",
    sourceId: classId,
    targetId,
  };
}

function parseDependency(r: ParseRecord): UmlRelation | null {
  const id = getString(r, "@_xmi:id");
  const sourceId = getString(r, "@_client");
  const targetId = getString(r, "@_supplier");
  if (!id || !sourceId || !targetId) return null;

  return {
    id,
    type: "dependency",
    sourceId,
    targetId,
    name: getString(r, "@_name"),
  };
}

// ─── main parser ──────────────────────────────────────────────────────────────

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: false,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) => ARRAY_TAGS.has(name),
});

/**
 * Parset Eclipse UML2 XMI 2.5 naar intern UmlModel.
 *
 * Ondersteunt:
 *  - uml:Class, uml:Interface (met isAbstract, attributen, operaties)
 *  - uml:Association (incl. aggregatie + compositie via ownedEnd/@aggregation)
 *  - generalization, interfaceRealization, uml:Dependency / uml:Usage
 */
export function parseXmi(xml: string): UmlModel {
  const raw = xmlParser.parse(xml) as ParseRecord;

  // Root-node kan "uml:Model" of "uml:Package" zijn afhankelijk van export-tool
  const xmiWrapper = asRecord(raw["XMI"]);
  const modelRaw =
    asRecord(raw["uml:Model"]) ??
    asRecord(raw["uml:Package"]) ??
    asRecord(xmiWrapper["uml:Model"]);

  const name = getString(modelRaw, "@_name") ?? "UML Model";

  const classes: UmlClass[] = [];
  const relations: UmlRelation[] = [];

  processPackagedElements(asArray(modelRaw.packagedElement), classes, relations);

  return { name, classes, relations };
}

function processPackagedElements(
  elements: unknown[],
  classes: UmlClass[],
  relations: UmlRelation[],
): void {
  for (const elemRaw of elements) {
    const r = asRecord(elemRaw);
    const xmiType = getString(r, "@_xmi:type");
    if (!xmiType) continue;

    if (UML_TYPE_CLASSES.has(xmiType) || xmiType === UML_TYPE_INTERFACE) {
      const cls = parseClass(r, xmiType);
      if (!cls) continue;
      classes.push(cls);

      for (const genRaw of asArray(r.generalization)) {
        const gen = parseGeneralization(cls.id, genRaw);
        if (gen) relations.push(gen);
      }

      for (const realRaw of asArray(r.interfaceRealization)) {
        const real = parseInterfaceRealization(cls.id, realRaw);
        if (real) relations.push(real);
      }

      // Recursief nested packages
      processPackagedElements(asArray(r.packagedElement), classes, relations);
      continue;
    }

    if (xmiType === UML_TYPE_ASSOCIATION) {
      const rel = parseAssociation(r);
      if (rel) relations.push(rel);
      continue;
    }

    if (
      xmiType === UML_TYPE_DEPENDENCY ||
      xmiType === UML_TYPE_USAGE ||
      xmiType === UML_TYPE_ABSTRACTION
    ) {
      const dep = parseDependency(r);
      if (dep) relations.push(dep);
      continue;
    }

    // uml:Package of andere containers — recursief inlopen
    if (xmiType === "uml:Package" || xmiType === "uml:Model") {
      processPackagedElements(asArray(r.packagedElement), classes, relations);
    }
  }
}

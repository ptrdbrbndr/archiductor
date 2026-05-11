/**
 * ComponentParser — parset Eclipse UML2 XMI 2.5 naar UmlComponentDiagram.
 *
 * Ondersteunde elements:
 *  - <packagedElement xmi:type="uml:Component"> → UmlComponent
 *  - <interfaceRealization> → provided interfaces
 *  - <usage> of <packagedElement xmi:type="uml:Usage"> → required interfaces + relatie
 *  - <packagedElement xmi:type="uml:Dependency"> → dependency relatie
 *  - <packagedElement xmi:type="uml:Realization"> → realization relatie
 *
 * Spec: UML 2.5 Components — §11
 */

import { XMLParser } from "fast-xml-parser";
import type {
  UmlComponent,
  UmlComponentDiagram,
  UmlComponentRelation,
  UmlComponentRelationType,
} from "../types.js";

// ─── constants ────────────────────────────────────────────────────────────────

const ARRAY_TAGS = new Set([
  "packagedElement",
  "interfaceRealization",
  "ownedEnd",
  "usage",
]);

// ─── internal helpers ─────────────────────────────────────────────────────────

interface ParseRecord {
  [key: string]: unknown;
}

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

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value !== undefined && value !== null) return [value];
  return [];
}

function stripPrefix(ref: string | undefined): string {
  if (!ref) return "";
  const hashIdx = ref.lastIndexOf("#");
  if (hashIdx !== -1) return ref.slice(hashIdx + 1);
  const slashIdx = ref.lastIndexOf("/");
  if (slashIdx !== -1) return ref.slice(slashIdx + 1);
  return ref;
}

// ─── parsers ──────────────────────────────────────────────────────────────────

function parseComponent(r: ParseRecord): UmlComponent | null {
  const id = getString(r, "@_xmi:id");
  const name = getString(r, "@_name");
  if (!id || !name) return null;

  const providedInterfaces: string[] = [];
  const requiredInterfaces: string[] = [];

  // Provided: interfaceRealization elementen
  for (const realRaw of asArray(r.interfaceRealization)) {
    const real = asRecord(realRaw);
    const contract =
      getString(real, "@_contract") ??
      stripPrefix(getString(real, "@_supplier"));
    if (contract) providedInterfaces.push(contract);
  }

  // Required: usage elementen binnen component
  for (const usageRaw of asArray(r.usage)) {
    const usage = asRecord(usageRaw);
    const supplier =
      getString(usage, "@_supplier") ??
      stripPrefix(getString(usage, "@_target"));
    if (supplier) requiredInterfaces.push(supplier);
  }

  return {
    id,
    name,
    stereotype: getString(r, "@_stereotype"),
    providedInterfaces,
    requiredInterfaces,
  };
}

function parseRelation(r: ParseRecord, type: UmlComponentRelationType): UmlComponentRelation | null {
  const id = getString(r, "@_xmi:id");
  const sourceId = getString(r, "@_client");
  const targetId = getString(r, "@_supplier");
  if (!id || !sourceId || !targetId) return null;
  return { id, type, sourceId, targetId };
}

// ─── XML parser ───────────────────────────────────────────────────────────────

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: false,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) => ARRAY_TAGS.has(name),
});

/**
 * Parset Eclipse UML2 XMI 2.5 met Component-elementen naar UmlComponentDiagram.
 */
export function parseComponentXmi(xml: string): UmlComponentDiagram {
  const raw = xmlParser.parse(xml) as ParseRecord;

  const xmiWrapper = asRecord(raw["XMI"]);
  const modelRaw =
    asRecord(raw["uml:Model"]) ??
    asRecord(raw["uml:Package"]) ??
    asRecord(xmiWrapper["uml:Model"]);

  const components: UmlComponent[] = [];
  const relations: UmlComponentRelation[] = [];

  for (const elemRaw of asArray(modelRaw.packagedElement)) {
    const r = asRecord(elemRaw);
    const xmiType = getString(r, "@_xmi:type");

    if (xmiType === "uml:Component") {
      const comp = parseComponent(r);
      if (comp) components.push(comp);
      continue;
    }

    if (xmiType === "uml:Dependency") {
      const rel = parseRelation(r, "dependency");
      if (rel) relations.push(rel);
      continue;
    }

    if (xmiType === "uml:Realization") {
      const rel = parseRelation(r, "realization");
      if (rel) relations.push(rel);
      continue;
    }

    if (xmiType === "uml:Usage") {
      const rel = parseRelation(r, "usage");
      if (rel) relations.push(rel);
      continue;
    }
  }

  return { type: "component", components, relations };
}

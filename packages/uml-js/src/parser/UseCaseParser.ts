/**
 * UseCaseParser — parset Eclipse UML2 XMI 2.5 naar UmlUseCaseDiagram.
 *
 * Ondersteunde elements:
 *  - <packagedElement xmi:type="uml:Actor"> → UmlActor
 *  - <packagedElement xmi:type="uml:UseCase"> → UmlUseCase
 *  - <packagedElement xmi:type="uml:Association"> + Actor+UseCase ends → association
 *  - <include> binnen UseCase → include relatie
 *  - <extend> binnen UseCase → extend relatie
 *  - <generalization> → generalization relatie
 *
 * Spec: UML 2.5 Use Cases — §18
 */

import { XMLParser } from "fast-xml-parser";
import type {
  UmlActor,
  UmlUseCase,
  UmlUseCaseDiagram,
  UmlUseCaseRelation,
  UmlUseCaseRelationType,
} from "../types.js";

// ─── constants ────────────────────────────────────────────────────────────────

const ARRAY_TAGS = new Set([
  "packagedElement",
  "ownedEnd",
  "generalization",
  "include",
  "extend",
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

// ─── parsers ──────────────────────────────────────────────────────────────────

function parseActor(r: ParseRecord): UmlActor | null {
  const id = getString(r, "@_xmi:id");
  const name = getString(r, "@_name");
  if (!id || !name) return null;
  return { id, name };
}

function parseUseCase(r: ParseRecord): UmlUseCase | null {
  const id = getString(r, "@_xmi:id");
  const name = getString(r, "@_name");
  if (!id || !name) return null;
  return { id, name, description: getString(r, "@_description") };
}

function parseIncludeExtend(
  ucId: string,
  raw: unknown,
  type: UmlUseCaseRelationType,
): UmlUseCaseRelation | null {
  const r = asRecord(raw);
  const id = getString(r, "@_xmi:id");
  const addition = getString(r, "@_addition"); // include: addition
  const extendedCase = getString(r, "@_extendedCase"); // extend: extendedCase
  const targetId = addition ?? extendedCase;
  if (!id || !targetId) return null;
  return { id, type, sourceId: ucId, targetId };
}

function parseGeneralization(
  sourceId: string,
  raw: unknown,
): UmlUseCaseRelation | null {
  const r = asRecord(raw);
  const id = getString(r, "@_xmi:id") ?? `gen-${sourceId}`;
  const targetId = getString(r, "@_general");
  if (!targetId) return null;
  return { id, type: "generalization", sourceId, targetId };
}

function parseAssociation(
  r: ParseRecord,
  actorIds: Set<string>,
): UmlUseCaseRelation | null {
  const id = getString(r, "@_xmi:id");
  if (!id) return null;

  const ends = asArray(r.ownedEnd);
  if (ends.length < 2) return null;

  const endA = asRecord(ends[0]);
  const endB = asRecord(ends[1]);
  const typeA = getString(endA, "@_type");
  const typeB = getString(endB, "@_type");
  if (!typeA || !typeB) return null;

  // Source = actor wanneer aanwezig, anders eerste end
  const sourceId = actorIds.has(typeA) ? typeA : typeB;
  const targetId = actorIds.has(typeA) ? typeB : typeA;

  return { id, type: "association", sourceId, targetId };
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
 * Parset Eclipse UML2 XMI 2.5 met Actor + UseCase elements naar UmlUseCaseDiagram.
 */
export function parseUseCaseXmi(xml: string): UmlUseCaseDiagram {
  const raw = xmlParser.parse(xml) as ParseRecord;

  const xmiWrapper = asRecord(raw["XMI"]);
  const modelRaw =
    asRecord(raw["uml:Model"]) ??
    asRecord(raw["uml:Package"]) ??
    asRecord(xmiWrapper["uml:Model"]);

  const actors: UmlActor[] = [];
  const useCases: UmlUseCase[] = [];
  const relations: UmlUseCaseRelation[] = [];

  const systemBoundary = getString(modelRaw, "@_name");

  for (const elemRaw of asArray(modelRaw.packagedElement)) {
    const r = asRecord(elemRaw);
    const xmiType = getString(r, "@_xmi:type");

    if (xmiType === "uml:Actor") {
      const actor = parseActor(r);
      if (actor) actors.push(actor);
      continue;
    }

    if (xmiType === "uml:UseCase") {
      const uc = parseUseCase(r);
      if (uc) {
        useCases.push(uc);

        for (const incRaw of asArray(r.include)) {
          const rel = parseIncludeExtend(uc.id, incRaw, "include");
          if (rel) relations.push(rel);
        }

        for (const extRaw of asArray(r.extend)) {
          const rel = parseIncludeExtend(uc.id, extRaw, "extend");
          if (rel) relations.push(rel);
        }

        for (const genRaw of asArray(r.generalization)) {
          const rel = parseGeneralization(uc.id, genRaw);
          if (rel) relations.push(rel);
        }
      }
      continue;
    }

    if (xmiType === "uml:Association") {
      const actorIds = new Set(actors.map((a) => a.id));
      const rel = parseAssociation(r, actorIds);
      if (rel) relations.push(rel);
      continue;
    }
  }

  return { type: "usecase", actors, useCases, relations, systemBoundary };
}

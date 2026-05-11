/**
 * SequenceParser — parset Eclipse UML2 XMI 2.5 Interaction naar UmlSequenceDiagram.
 *
 * Input: <packagedElement xmi:type="uml:Interaction"> of <ownedBehavior xmi:type="uml:Interaction">
 *
 * Spec: UML 2.5 Interactions — §17
 */

import { XMLParser } from "fast-xml-parser";
import type {
  UmlFragment,
  UmlLifeline,
  UmlMessage,
  UmlMessageType,
  UmlSequenceDiagram,
} from "../types.js";

// ─── constants ────────────────────────────────────────────────────────────────

const ARRAY_TAGS = new Set([
  "packagedElement",
  "ownedBehavior",
  "lifeline",
  "message",
  "fragment",
  "operand",
]);

const MESSAGE_TYPE_MAP: Record<string, UmlMessageType> = {
  synchCall: "sync",
  asynchCall: "async",
  asynchSignal: "async",
  reply: "return",
  createMessage: "create",
  deleteMessage: "destroy",
};

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

function parseLifeline(raw: unknown, index: number): UmlLifeline | null {
  const r = asRecord(raw);
  const id = getString(r, "@_xmi:id");
  const name = getString(r, "@_name");
  if (!id || !name) return null;

  const represents = asRecord(r.represents);
  const typeRef = getString(represents, "@_xmi:idref") ?? getString(represents, "@_type");

  return { id, name, type: typeRef ?? `Object${index}` };
}

function parseMessage(raw: unknown, index: number): UmlMessage | null {
  const r = asRecord(raw);
  const id = getString(r, "@_xmi:id");
  const label = getString(r, "@_name") ?? "";
  if (!id) return null;

  // sendEvent en receiveEvent bevatten refs naar lifeline-covers
  const sendEvent = asRecord(r.sendEvent);
  const receiveEvent = asRecord(r.receiveEvent);
  const from =
    getString(sendEvent, "@_covered") ??
    getString(r, "@_sendEvent") ??
    getString(r, "@_sender") ??
    "unknown";
  const to =
    getString(receiveEvent, "@_covered") ??
    getString(r, "@_receiveEvent") ??
    getString(r, "@_receiver") ??
    "unknown";

  const rawSort = getString(r, "@_messageSort") ?? "synchCall";
  const type = MESSAGE_TYPE_MAP[rawSort] ?? "sync";

  return { id, from, to, label, type, order: index };
}

function parseFragment(raw: unknown): UmlFragment | null {
  const r = asRecord(raw);
  const id = getString(r, "@_xmi:id");
  if (!id) return null;

  const operator = (getString(r, "@_interactionOperator") ?? "loop") as UmlFragment["operator"];
  const label = getString(r, "@_name");

  const operands: string[] = [];
  for (const opRaw of asArray(r.operand)) {
    const op = asRecord(opRaw);
    const opId = getString(op, "@_xmi:id");
    if (opId) operands.push(opId);
  }

  return { id, operator, label, operands };
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
 * Parset Eclipse UML2 XMI 2.5 met een Interaction-element naar UmlSequenceDiagram.
 */
export function parseSequenceXmi(xml: string): UmlSequenceDiagram {
  const raw = xmlParser.parse(xml) as ParseRecord;

  const xmiWrapper = asRecord(raw["XMI"]);
  const modelRaw =
    asRecord(raw["uml:Model"]) ??
    asRecord(raw["uml:Package"]) ??
    asRecord(xmiWrapper["uml:Model"]);

  // Zoek Interaction in packagedElement of ownedBehavior
  const interaction = findInteraction(modelRaw);

  const lifelines: UmlLifeline[] = [];
  const messages: UmlMessage[] = [];
  const fragments: UmlFragment[] = [];

  for (const [i, llRaw] of asArray(interaction.lifeline).entries()) {
    const ll = parseLifeline(llRaw, i);
    if (ll) lifelines.push(ll);
  }

  for (const [i, msgRaw] of asArray(interaction.message).entries()) {
    const msg = parseMessage(msgRaw, i);
    if (msg) messages.push(msg);
  }

  for (const fragRaw of asArray(interaction.fragment)) {
    const fragRecord = asRecord(fragRaw);
    const xmiType = getString(fragRecord, "@_xmi:type");
    if (xmiType === "uml:CombinedFragment") {
      const frag = parseFragment(fragRaw);
      if (frag) fragments.push(frag);
    }
  }

  return { type: "sequence", lifelines, messages, fragments };
}

function findInteraction(modelRaw: ParseRecord): ParseRecord {
  for (const elemRaw of asArray(modelRaw.packagedElement)) {
    const r = asRecord(elemRaw);
    if (getString(r, "@_xmi:type") === "uml:Interaction") return r;
  }
  for (const elemRaw of asArray(modelRaw.ownedBehavior)) {
    const r = asRecord(elemRaw);
    if (getString(r, "@_xmi:type") === "uml:Interaction") return r;
  }
  return {};
}

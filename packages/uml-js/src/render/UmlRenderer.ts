/**
 * UmlRenderer — custom diagram-js BaseRenderer voor UML class-diagram shapes
 * en connections.
 *
 * Ondersteunde shapes:
 *  - Class (normaal, abstract, interface)
 *  - Compartimenten: header / attributen / operaties
 *
 * Ondersteunde connections:
 *  - association        → gewone pijl (→)
 *  - generalization     → open driehoek (△)
 *  - realization        → gestippeld + open driehoek
 *  - dependency         → gestippeld (-->)
 *  - aggregation        → open diamant + lijn (◇—)
 *  - composition        → gevuld diamant + lijn (◆—)
 *
 * Shapes-formaat:
 *  - Breedte: CLASS_WIDTH (160px)
 *  - Header-hoogte: HEADER_HEIGHT (30px)
 *  - Rij-hoogte per attribuut/operatie: ROW_HEIGHT (20px)
 */

import BaseRenderer from "diagram-js/lib/draw/BaseRenderer.js";
import {
  append as svgAppend,
  attr as svgAttr,
  create as svgCreate,
} from "tiny-svg";

import type { UmlAttribute, UmlOperation, UmlRelationType } from "../types.js";

// ─── constants ────────────────────────────────────────────────────────────────

const CLASS_WIDTH = 160;
const HEADER_HEIGHT = 30;
const STEREOTYPE_HEIGHT = 18;
const ROW_HEIGHT = 20;
const COMPARTMENT_PADDING_LEFT = 8;
const COMPARTMENT_PADDING_TOP = 14;
const SEPARATOR_STROKE = "#666";
const CLASS_FILL = "#FFFDE7";
const CLASS_STROKE = "#555";
const INTERFACE_FILL = "#E3F2FD";
const ABSTRACT_FILL = "#F3E5F5";
const CONNECTION_STROKE = "#333";
const FONT_FAMILY = "system-ui, sans-serif";
const FONT_SIZE_NORMAL = 12;
const FONT_SIZE_STEREOTYPE = 10;

const VISIBILITY_SYMBOL: Record<string, string> = {
  public: "+",
  protected: "#",
  private: "-",
  package: "~",
};

// ─── shape businessObject types ───────────────────────────────────────────────

interface ClassBusinessObject {
  umlType: "class";
  name: string;
  isAbstract: boolean;
  isInterface: boolean;
  stereotype?: string;
  attributes: UmlAttribute[];
  operations: UmlOperation[];
}

interface ConnectionBusinessObject {
  umlType: "connection";
  relationType: UmlRelationType;
  name?: string;
}

interface Waypoint {
  x: number;
  y: number;
}

interface DiagramElement {
  width: number;
  height: number;
  businessObject?: ClassBusinessObject;
}

interface DiagramConnection {
  waypoints?: Waypoint[];
  businessObject?: ConnectionBusinessObject;
}

// ─── renderer ─────────────────────────────────────────────────────────────────

export class UmlRenderer extends BaseRenderer {
  static $inject = ["eventBus"];

  constructor(eventBus: unknown) {
    super(eventBus as never, 2000);
  }

  override canRender(): boolean {
    return true;
  }

  override drawShape(parentNode: SVGElement, element: DiagramElement) {
    const bo = element.businessObject;
    if (!bo) return drawFallbackRect(parentNode, element);

    return drawClassShape(parentNode, element, bo);
  }

  override drawConnection(
    parentNode: SVGElement,
    connection: DiagramConnection,
  ) {
    const waypoints = connection.waypoints ?? [];
    if (waypoints.length < 2) {
      const empty = svgCreate("g");
      svgAppend(parentNode, empty);
      return empty as unknown as SVGElement;
    }

    const bo = connection.businessObject;
    const relationType: UmlRelationType = bo?.relationType ?? "association";

    return drawUmlConnection(parentNode, waypoints, relationType, bo?.name);
  }
}

// ─── shape drawing ────────────────────────────────────────────────────────────

function drawClassShape(
  parent: SVGElement,
  element: DiagramElement,
  bo: ClassBusinessObject,
): SVGElement {
  const w = element.width;
  const hasStereotype = !!bo.stereotype || bo.isInterface;
  const stereoLabel = bo.isInterface ? "«interface»" : bo.stereotype ? `«${bo.stereotype}»` : "";

  let currentY = 0;

  // ── Header-compartiment ────────────────────────────────────────────────────
  const headerRows = hasStereotype ? 2 : 1;
  const headerH = hasStereotype
    ? STEREOTYPE_HEIGHT + HEADER_HEIGHT
    : HEADER_HEIGHT;

  const fillColor = bo.isInterface
    ? INTERFACE_FILL
    : bo.isAbstract
      ? ABSTRACT_FILL
      : CLASS_FILL;

  drawRect(parent, 0, currentY, w, headerH, fillColor, CLASS_STROKE);

  if (hasStereotype) {
    drawText(parent, stereoLabel, w / 2, currentY + STEREOTYPE_HEIGHT - 2, {
      anchor: "middle",
      size: FONT_SIZE_STEREOTYPE,
      italic: false,
    });
    currentY += STEREOTYPE_HEIGHT;
  }

  drawText(parent, bo.name, w / 2, currentY + HEADER_HEIGHT / 2 + 4, {
    anchor: "middle",
    size: FONT_SIZE_NORMAL,
    bold: true,
    italic: bo.isAbstract && !bo.isInterface,
  });
  currentY += HEADER_HEIGHT;

  // ── Attributen-compartiment ────────────────────────────────────────────────
  if (bo.attributes.length > 0) {
    const attrH = bo.attributes.length * ROW_HEIGHT + 4;
    drawRect(parent, 0, currentY, w, attrH, fillColor, CLASS_STROKE);
    drawHLine(parent, 0, currentY, w);

    let rowY = currentY + COMPARTMENT_PADDING_TOP;
    for (const attr of bo.attributes) {
      const label = formatAttribute(attr);
      const textStyle = { anchor: "start" as const, size: FONT_SIZE_NORMAL, italic: attr.isStatic };
      drawText(parent, label, COMPARTMENT_PADDING_LEFT, rowY, textStyle);
      rowY += ROW_HEIGHT;
    }
    currentY += attrH;
  }

  // ── Operaties-compartiment ─────────────────────────────────────────────────
  if (bo.operations.length > 0) {
    const opH = bo.operations.length * ROW_HEIGHT + 4;
    drawRect(parent, 0, currentY, w, opH, fillColor, CLASS_STROKE);
    drawHLine(parent, 0, currentY, w);

    let rowY = currentY + COMPARTMENT_PADDING_TOP;
    for (const op of bo.operations) {
      const label = formatOperation(op);
      drawText(parent, label, COMPARTMENT_PADDING_LEFT, rowY, {
        anchor: "start",
        size: FONT_SIZE_NORMAL,
      });
      rowY += ROW_HEIGHT;
    }
    currentY += opH;
  }

  // Lege compartimenten: altijd minimaal header + lege sectie als geen attrs/ops
  if (bo.attributes.length === 0 && bo.operations.length === 0) {
    drawRect(parent, 0, currentY, w, ROW_HEIGHT, fillColor, CLASS_STROKE);
    drawHLine(parent, 0, currentY, w);
    currentY += ROW_HEIGHT;
  }

  // Omhullende outer rect (zodat diagram-js hitbox klopt)
  const outer = svgCreate("rect");
  svgAttr(outer, {
    x: 0,
    y: 0,
    width: w,
    height: currentY,
    fill: "none",
    stroke: CLASS_STROKE,
    "stroke-width": 1.5,
  });
  svgAppend(parent, outer);

  return outer as unknown as SVGElement;
}

function drawFallbackRect(
  parent: SVGElement,
  element: DiagramElement,
): SVGElement {
  const rect = svgCreate("rect");
  svgAttr(rect, {
    x: 0,
    y: 0,
    width: element.width,
    height: element.height,
    fill: CLASS_FILL,
    stroke: CLASS_STROKE,
    "stroke-width": 1.5,
  });
  svgAppend(parent, rect);
  return rect as unknown as SVGElement;
}

// ─── connection drawing ───────────────────────────────────────────────────────

function drawUmlConnection(
  parent: SVGElement,
  waypoints: Waypoint[],
  relationType: UmlRelationType,
  label?: string,
): SVGElement {
  const isDashed =
    relationType === "realization" || relationType === "dependency";

  const path = svgCreate("path");
  svgAttr(path, {
    d: buildPathD(waypoints),
    stroke: CONNECTION_STROKE,
    "stroke-width": 1.5,
    fill: "none",
    ...(isDashed ? { "stroke-dasharray": "6 4" } : {}),
  });
  svgAppend(parent, path);

  const start = waypoints[0]!;
  const next = waypoints[1]!;
  const end = waypoints[waypoints.length - 1]!;
  const prev = waypoints[waypoints.length - 2]!;

  drawSourceDecoration(parent, relationType, start, next);
  drawTargetDecoration(parent, relationType, prev, end);

  if (label) {
    const mid = midpoint(waypoints);
    drawText(parent, label, mid.x, mid.y - 6, {
      anchor: "middle",
      size: FONT_SIZE_NORMAL,
    });
  }

  return path as unknown as SVGElement;
}

function drawSourceDecoration(
  parent: SVGElement,
  type: UmlRelationType,
  start: Waypoint,
  next: Waypoint,
): void {
  if (type !== "aggregation" && type !== "composition") return;

  const { ux, uy, nx, ny } = unitAndNormal(start, next);
  const back = { x: start.x + ux * 14, y: start.y + uy * 14 };
  const left = { x: start.x + ux * 7 + nx * 5, y: start.y + uy * 7 + ny * 5 };
  const right = { x: start.x + ux * 7 - nx * 5, y: start.y + uy * 7 - ny * 5 };

  const diamond = svgCreate("path");
  svgAttr(diamond, {
    d: `M ${start.x} ${start.y} L ${left.x} ${left.y} L ${back.x} ${back.y} L ${right.x} ${right.y} Z`,
    stroke: CONNECTION_STROKE,
    "stroke-width": 1.5,
    fill: type === "composition" ? CONNECTION_STROKE : "#FFFFFF",
  });
  svgAppend(parent, diamond);
}

function drawTargetDecoration(
  parent: SVGElement,
  type: UmlRelationType,
  prev: Waypoint,
  end: Waypoint,
): void {
  const { ux, uy, nx, ny } = unitAndNormal(prev, end);

  switch (type) {
    case "association":
      appendOpenArrow(parent, end, ux, uy, nx, ny);
      return;
    case "generalization":
    case "realization":
      appendOpenTriangle(parent, end, ux, uy, nx, ny);
      return;
    case "dependency":
      appendOpenArrow(parent, end, ux, uy, nx, ny);
      return;
    case "aggregation":
    case "composition":
      // Target heeft geen marker — bron heeft diamant
      return;
  }
}

// ─── SVG primitives ───────────────────────────────────────────────────────────

interface TextStyle {
  anchor: "start" | "middle" | "end";
  size: number;
  bold?: boolean;
  italic?: boolean;
}

function drawRect(
  parent: SVGElement,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
): void {
  const rect = svgCreate("rect");
  svgAttr(rect, { x, y, width: w, height: h, fill, stroke, "stroke-width": 1 });
  svgAppend(parent, rect);
}

function drawHLine(parent: SVGElement, x: number, y: number, w: number): void {
  const line = svgCreate("line");
  svgAttr(line, {
    x1: x,
    y1: y,
    x2: x + w,
    y2: y,
    stroke: SEPARATOR_STROKE,
    "stroke-width": 1,
  });
  svgAppend(parent, line);
}

function drawText(
  parent: SVGElement,
  content: string,
  x: number,
  y: number,
  style: TextStyle,
): void {
  const text = svgCreate("text");
  const fontStyle = style.italic ? "italic" : "normal";
  const fontWeight = style.bold ? "bold" : "normal";
  svgAttr(text, {
    x,
    y,
    "text-anchor": style.anchor,
    "font-family": FONT_FAMILY,
    "font-size": style.size,
    "font-style": fontStyle,
    "font-weight": fontWeight,
    fill: "#222",
  });
  text.textContent = content;
  svgAppend(parent, text);
}

function buildPathD(waypoints: Waypoint[]): string {
  return waypoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");
}

function appendOpenArrow(
  parent: SVGElement,
  tip: Waypoint,
  ux: number,
  uy: number,
  nx: number,
  ny: number,
): void {
  const left = { x: tip.x - ux * 10 + nx * 5, y: tip.y - uy * 10 + ny * 5 };
  const right = { x: tip.x - ux * 10 - nx * 5, y: tip.y - uy * 10 - ny * 5 };
  const arrow = svgCreate("path");
  svgAttr(arrow, {
    d: `M ${left.x} ${left.y} L ${tip.x} ${tip.y} L ${right.x} ${right.y}`,
    stroke: CONNECTION_STROKE,
    "stroke-width": 1.5,
    fill: "none",
  });
  svgAppend(parent, arrow);
}

function appendOpenTriangle(
  parent: SVGElement,
  tip: Waypoint,
  ux: number,
  uy: number,
  nx: number,
  ny: number,
): void {
  const base1 = { x: tip.x - ux * 14 + nx * 8, y: tip.y - uy * 14 + ny * 8 };
  const base2 = { x: tip.x - ux * 14 - nx * 8, y: tip.y - uy * 14 - ny * 8 };
  const tri = svgCreate("path");
  svgAttr(tri, {
    d: `M ${tip.x} ${tip.y} L ${base1.x} ${base1.y} L ${base2.x} ${base2.y} Z`,
    stroke: CONNECTION_STROKE,
    "stroke-width": 1.5,
    fill: "#FFFFFF",
  });
  svgAppend(parent, tri);
}

// ─── math helpers ─────────────────────────────────────────────────────────────

function unitAndNormal(
  from: Waypoint,
  to: Waypoint,
): { ux: number; uy: number; nx: number; ny: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return { ux, uy, nx: -uy, ny: ux };
}

function midpoint(waypoints: Waypoint[]): Waypoint {
  if (waypoints.length === 0) return { x: 0, y: 0 };
  if (waypoints.length === 1) return { ...(waypoints[0] ?? { x: 0, y: 0 }) };
  const midIdx = Math.floor(waypoints.length / 2);
  const a = waypoints[midIdx - 1];
  const b = waypoints[midIdx];
  if (!a || !b) return waypoints[0] ?? { x: 0, y: 0 };
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// ─── format helpers ───────────────────────────────────────────────────────────

function formatAttribute(attr: UmlAttribute): string {
  const vis = VISIBILITY_SYMBOL[attr.visibility] ?? "+";
  const staticMark = attr.isStatic ? " {static}" : "";
  return `${vis} ${attr.name}: ${attr.type}${staticMark}`;
}

function formatOperation(op: UmlOperation): string {
  const vis = VISIBILITY_SYMBOL[op.visibility] ?? "+";
  const params = op.parameters
    .map((p) => `${p.name}: ${p.type}`)
    .join(", ");
  return `${vis} ${op.name}(${params}): ${op.returnType}`;
}

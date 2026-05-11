/**
 * UseCaseRenderer — SVG-renderer voor UML use case diagrams.
 *
 * Rendert:
 *  - System boundary: rechthoek met naam bovenin
 *  - Actor: stickfigure (cirkel + romp + armen + benen) met naam eronder
 *  - UseCase: ellips met naam erin
 *  - Relations:
 *    - association     → gewone lijn
 *    - include/extend  → gestippelde pijl met «include»/«extend» label
 *    - generalization  → open driehoekpijl
 */

import type { UmlUseCaseDiagram, UmlUseCaseRelation } from "../types.js";
import {
  append as svgAppend,
  attr as svgAttr,
  create as svgCreate,
} from "tiny-svg";
import { computeUseCaseLayout } from "../layout/usecaseLayout.js";

// ─── constants ────────────────────────────────────────────────────────────────

const BOUNDARY_STROKE = "#555";
const BOUNDARY_HEADER_FONT_SIZE = 13;
const BOUNDARY_LABEL_PAD = 16;
const ACTOR_STROKE = "#333";
const ACTOR_HEAD_R = 10;
const ACTOR_BODY_LENGTH = 24;
const ACTOR_ARM_Y_OFFSET = 8;
const ACTOR_ARM_LENGTH = 16;
const ACTOR_LEG_LENGTH = 20;
const ACTOR_NAME_OFFSET_Y = 14;
const USECASE_FILL = "#FFF9C4";
const USECASE_STROKE = "#555";
const USECASE_FONT_SIZE = 11;
const RELATION_STROKE = "#444";
const ARROW_LENGTH = 10;
const ARROW_HALF_WIDTH = 6;
const TRI_BASE_DIST = 14;
const TRI_BASE_HALF = 8;
const FONT_FAMILY = "system-ui, sans-serif";

// Cast helpers — identical pattern to UmlRenderer.ts
type SvgEl = SVGElement;

function el(tag: string): SvgEl {
  return svgCreate(tag) as unknown as SvgEl;
}

function app(parent: SvgEl, child: SvgEl): void {
  svgAppend(parent, child);
}

function atr(node: SvgEl, attrs: Record<string, unknown>): void {
  svgAttr(node, attrs as import("tiny-svg").KeyValue);
}

// ─── public API ───────────────────────────────────────────────────────────────

export function renderUseCaseDiagram(
  parent: SVGElement,
  diagram: UmlUseCaseDiagram,
): SVGElement {
  const layout = computeUseCaseLayout(diagram.actors, diagram.useCases);

  const group = el("g");
  atr(group, { class: "usecase-diagram" });

  renderBoundary(group, layout.boundary, diagram.systemBoundary);

  for (const actor of diagram.actors) {
    const l = layout.actors.find((a) => a.id === actor.id);
    if (!l) continue;
    renderActor(group, l.centerX, l.y, actor.name);
  }

  for (const uc of diagram.useCases) {
    const l = layout.useCases.find((u) => u.id === uc.id);
    if (!l) continue;
    renderUseCase(group, l.x, l.y, l.width, l.height, uc.name);
  }

  const actorCenters = new Map(layout.actors.map((a) => [a.id, { x: a.centerX, y: a.centerY }]));
  const ucCenters = new Map(layout.useCases.map((u) => [u.id, { x: u.centerX, y: u.centerY }]));

  for (const rel of diagram.relations) {
    const src = actorCenters.get(rel.sourceId) ?? ucCenters.get(rel.sourceId);
    const tgt = actorCenters.get(rel.targetId) ?? ucCenters.get(rel.targetId);
    if (!src || !tgt) continue;
    renderRelation(group, src, tgt, rel);
  }

  app(parent as SvgEl, group);
  return group;
}

// ─── boundary ────────────────────────────────────────────────────────────────

function renderBoundary(
  parent: SvgEl,
  boundary: { x: number; y: number; width: number; height: number },
  label?: string,
): void {
  const rect = el("rect");
  atr(rect, {
    x: boundary.x, y: boundary.y,
    width: boundary.width, height: boundary.height,
    fill: "none", stroke: BOUNDARY_STROKE, "stroke-width": 1.5,
  });
  app(parent, rect);

  if (label) {
    drawText(
      parent, label,
      boundary.x + boundary.width / 2,
      boundary.y + BOUNDARY_HEADER_FONT_SIZE + BOUNDARY_LABEL_PAD,
      BOUNDARY_HEADER_FONT_SIZE, "middle", true,
    );
  }
}

// ─── actor ────────────────────────────────────────────────────────────────────

function renderActor(parent: SvgEl, cx: number, topY: number, name: string): void {
  const headCY = topY + ACTOR_HEAD_R;
  const neckY = headCY + ACTOR_HEAD_R;
  const waistY = neckY + ACTOR_BODY_LENGTH;
  const feetY = waistY + ACTOR_LEG_LENGTH;

  const circle = el("circle");
  atr(circle, { cx, cy: headCY, r: ACTOR_HEAD_R, fill: "white", stroke: ACTOR_STROKE, "stroke-width": 1.5 });
  app(parent, circle);

  drawLine(parent, cx, neckY, cx, waistY);
  drawLine(parent, cx - ACTOR_ARM_LENGTH, neckY + ACTOR_ARM_Y_OFFSET, cx + ACTOR_ARM_LENGTH, neckY + ACTOR_ARM_Y_OFFSET);
  drawLine(parent, cx, waistY, cx - ACTOR_ARM_LENGTH, feetY);
  drawLine(parent, cx, waistY, cx + ACTOR_ARM_LENGTH, feetY);

  drawText(parent, name, cx, feetY + ACTOR_NAME_OFFSET_Y, 11, "middle");
}

// ─── use case ────────────────────────────────────────────────────────────────

function renderUseCase(
  parent: SvgEl,
  x: number,
  y: number,
  w: number,
  h: number,
  name: string,
): void {
  const ellipse = el("ellipse");
  atr(ellipse, {
    cx: x + w / 2, cy: y + h / 2,
    rx: w / 2, ry: h / 2,
    fill: USECASE_FILL, stroke: USECASE_STROKE, "stroke-width": 1.5,
  });
  app(parent, ellipse);

  drawText(parent, name, x + w / 2, y + h / 2 + 4, USECASE_FONT_SIZE, "middle");
}

// ─── relations ───────────────────────────────────────────────────────────────

function renderRelation(
  parent: SvgEl,
  src: { x: number; y: number },
  tgt: { x: number; y: number },
  rel: UmlUseCaseRelation,
): void {
  const dashed = rel.type === "include" || rel.type === "extend";
  const stereotypeLabel = rel.type === "include"
    ? "«include»"
    : rel.type === "extend"
      ? "«extend»"
      : rel.label;

  drawRelLine(parent, src.x, src.y, tgt.x, tgt.y, dashed);

  if (rel.type === "generalization") {
    drawTriArrow(parent, src, tgt);
  } else {
    drawOpenArrow(parent, src, tgt);
  }

  if (stereotypeLabel) {
    const midX = (src.x + tgt.x) / 2;
    const midY = (src.y + tgt.y) / 2;
    drawText(parent, stereotypeLabel, midX, midY - 6, 10, "middle");
  }
}

function drawRelLine(
  parent: SvgEl,
  x1: number, y1: number,
  x2: number, y2: number,
  dashed: boolean,
): void {
  const line = el("line");
  atr(line, {
    x1, y1, x2, y2,
    stroke: RELATION_STROKE, "stroke-width": 1.5,
    ...(dashed ? { "stroke-dasharray": "6 4" } : {}),
  });
  app(parent, line);
}

function drawOpenArrow(
  parent: SvgEl,
  src: { x: number; y: number },
  tgt: { x: number; y: number },
): void {
  const { ux, uy, nx, ny } = unitAndNormal(src, tgt);
  const baseX = tgt.x - ux * ARROW_LENGTH;
  const baseY = tgt.y - uy * ARROW_LENGTH;
  const left = { x: baseX + nx * ARROW_HALF_WIDTH, y: baseY + ny * ARROW_HALF_WIDTH };
  const right = { x: baseX - nx * ARROW_HALF_WIDTH, y: baseY - ny * ARROW_HALF_WIDTH };

  const arrow = el("path");
  atr(arrow, {
    d: `M ${left.x} ${left.y} L ${tgt.x} ${tgt.y} L ${right.x} ${right.y}`,
    stroke: RELATION_STROKE, "stroke-width": 1.5, fill: "none",
  });
  app(parent, arrow);
}

function drawTriArrow(
  parent: SvgEl,
  src: { x: number; y: number },
  tgt: { x: number; y: number },
): void {
  const { ux, uy, nx, ny } = unitAndNormal(src, tgt);
  const b1 = { x: tgt.x - ux * TRI_BASE_DIST + nx * TRI_BASE_HALF, y: tgt.y - uy * TRI_BASE_DIST + ny * TRI_BASE_HALF };
  const b2 = { x: tgt.x - ux * TRI_BASE_DIST - nx * TRI_BASE_HALF, y: tgt.y - uy * TRI_BASE_DIST - ny * TRI_BASE_HALF };

  const tri = el("path");
  atr(tri, {
    d: `M ${tgt.x} ${tgt.y} L ${b1.x} ${b1.y} L ${b2.x} ${b2.y} Z`,
    stroke: RELATION_STROKE, "stroke-width": 1.5, fill: "#FFFFFF",
  });
  app(parent, tri);
}

// ─── SVG primitives ───────────────────────────────────────────────────────────

function drawLine(parent: SvgEl, x1: number, y1: number, x2: number, y2: number): void {
  const line = el("line");
  atr(line, { x1, y1, x2, y2, stroke: ACTOR_STROKE, "stroke-width": 1.5 });
  app(parent, line);
}

function drawText(
  parent: SvgEl,
  content: string,
  x: number,
  y: number,
  size: number,
  anchor: "start" | "middle" | "end",
  bold?: boolean,
): void {
  const text = el("text");
  atr(text, {
    x, y,
    "text-anchor": anchor,
    "font-family": FONT_FAMILY,
    "font-size": size,
    "font-weight": bold ? "bold" : "normal",
    fill: "#222",
  });
  text.textContent = content;
  app(parent, text);
}

// ─── math helpers ────────────────────────────────────────────────────────────

function unitAndNormal(
  from: { x: number; y: number },
  to: { x: number; y: number },
): { ux: number; uy: number; nx: number; ny: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return { ux, uy, nx: -uy, ny: ux };
}

/**
 * ComponentRenderer — SVG-renderer voor UML component diagrams.
 *
 * Rendert:
 *  - Component: rechthoek + «component» label + icoon rechtsboven
 *    (2 kleine rechthoekjes die uit de rand steken)
 *  - Provided interface: lolly-symbool (cirkel op een lijntje) aan de rechterkant
 *  - Required interface: socket-symbool (open boog op een lijntje) aan de linkerkant
 *  - Relations: gestippelde pijlen (dependency/usage/realization)
 */

import type { UmlComponent, UmlComponentDiagram, UmlComponentRelation } from "../types.js";
import {
  append as svgAppend,
  attr as svgAttr,
  create as svgCreate,
} from "tiny-svg";

// ─── constants ────────────────────────────────────────────────────────────────

const COMPONENT_WIDTH = 160;
const COMPONENT_BASE_HEIGHT = 60;
const COMPONENT_FILL = "#E3F2FD";
const COMPONENT_STROKE = "#555";
const ICON_SIZE = 10;
const ICON_TAB_W = 6;
const ICON_TAB_H = 4;
const ICON_MARGIN = 6;
const COMPONENT_FONT_SIZE = 12;
const STEREOTYPE_FONT_SIZE = 10;
const STEREOTYPE_Y = 18;
const NAME_Y = 36;
const GRID_COLS = 3;
const HORIZONTAL_SPACING = 200;
const VERTICAL_SPACING = 150;
const LOLLY_R = 8;
const LOLLY_STICK = 16;
const SOCKET_R = 8;
const SOCKET_STICK = 16;
const IFACE_GAP_Y = 28;
const FONT_FAMILY = "system-ui, sans-serif";
const RELATION_STROKE = "#444";
const ARROW_LENGTH = 10;
const ARROW_HALF_WIDTH = 5;
const TRI_BASE_DIST = 14;
const TRI_BASE_HALF = 8;

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

// ─── layout ───────────────────────────────────────────────────────────────────

interface ComponentLayout {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function computeComponentLayout(components: UmlComponent[]): ComponentLayout[] {
  return components.map((comp, index) => {
    const col = index % GRID_COLS;
    const row = Math.floor(index / GRID_COLS);
    const ifaceCount = Math.max(comp.providedInterfaces.length, comp.requiredInterfaces.length);
    const height = COMPONENT_BASE_HEIGHT + (ifaceCount > 0 ? ifaceCount * IFACE_GAP_Y + 10 : 0);
    return {
      id: comp.id,
      x: col * (COMPONENT_WIDTH + HORIZONTAL_SPACING),
      y: row * VERTICAL_SPACING,
      width: COMPONENT_WIDTH,
      height,
    };
  });
}

// ─── public API ───────────────────────────────────────────────────────────────

export function renderComponentDiagram(
  parent: SVGElement,
  diagram: UmlComponentDiagram,
): SVGElement {
  const group = el("g");
  atr(group, { class: "component-diagram" });

  const layouts = computeComponentLayout(diagram.components);
  const layoutById = new Map(layouts.map((l) => [l.id, l]));

  for (const comp of diagram.components) {
    const l = layoutById.get(comp.id);
    if (!l) continue;
    renderComponent(group, comp, l);
  }

  for (const rel of diagram.relations) {
    const src = layoutById.get(rel.sourceId);
    const tgt = layoutById.get(rel.targetId);
    if (!src || !tgt) continue;
    renderComponentRelation(group, src, tgt, rel);
  }

  app(parent as SvgEl, group);
  return group;
}

// ─── component ────────────────────────────────────────────────────────────────

function renderComponent(parent: SvgEl, comp: UmlComponent, l: ComponentLayout): void {
  const rect = el("rect");
  atr(rect, {
    x: l.x, y: l.y, width: l.width, height: l.height,
    fill: COMPONENT_FILL, stroke: COMPONENT_STROKE, "stroke-width": 1.5,
  });
  app(parent, rect);

  renderComponentIcon(parent, l.x + l.width - ICON_SIZE - ICON_MARGIN, l.y + ICON_MARGIN);

  const stereoLabel = comp.stereotype ? `«${comp.stereotype}»` : "«component»";
  drawText(parent, stereoLabel, l.x + l.width / 2, l.y + STEREOTYPE_Y, STEREOTYPE_FONT_SIZE, "middle");
  drawText(parent, comp.name, l.x + l.width / 2, l.y + NAME_Y, COMPONENT_FONT_SIZE, "middle", true);

  comp.providedInterfaces.forEach((iface, i) => {
    renderLolly(parent, l.x + l.width, l.y + COMPONENT_BASE_HEIGHT + i * IFACE_GAP_Y + 10, iface);
  });

  comp.requiredInterfaces.forEach((iface, i) => {
    renderSocket(parent, l.x, l.y + COMPONENT_BASE_HEIGHT + i * IFACE_GAP_Y + 10, iface);
  });
}

function renderComponentIcon(parent: SvgEl, x: number, y: number): void {
  const body = el("rect");
  atr(body, {
    x, y: y + ICON_TAB_H, width: ICON_SIZE, height: ICON_SIZE,
    fill: "white", stroke: COMPONENT_STROKE, "stroke-width": 1,
  });
  app(parent, body);

  drawTab(parent, x - ICON_TAB_W / 2, y, ICON_TAB_W, ICON_TAB_H);
  drawTab(parent, x - ICON_TAB_W / 2, y + ICON_TAB_H * 2 + 1, ICON_TAB_W, ICON_TAB_H);
}

function drawTab(parent: SvgEl, x: number, y: number, w: number, h: number): void {
  const tab = el("rect");
  atr(tab, { x, y, width: w, height: h, fill: "white", stroke: COMPONENT_STROKE, "stroke-width": 1 });
  app(parent, tab);
}

// ─── interface symbols ────────────────────────────────────────────────────────

function renderLolly(parent: SvgEl, attachX: number, attachY: number, label: string): void {
  drawLine(parent, attachX, attachY, attachX + LOLLY_STICK, attachY);

  const circle = el("circle");
  atr(circle, {
    cx: attachX + LOLLY_STICK + LOLLY_R, cy: attachY, r: LOLLY_R,
    fill: "white", stroke: COMPONENT_STROKE, "stroke-width": 1.5,
  });
  app(parent, circle);

  drawText(parent, label, attachX + LOLLY_STICK + LOLLY_R, attachY - LOLLY_R - 3, 9, "middle");
}

function renderSocket(parent: SvgEl, attachX: number, attachY: number, label: string): void {
  const stickEndX = attachX - SOCKET_STICK;
  drawLine(parent, attachX, attachY, stickEndX, attachY);

  const arc = el("path");
  atr(arc, {
    d: `M ${stickEndX} ${attachY - SOCKET_R} A ${SOCKET_R} ${SOCKET_R} 0 0 0 ${stickEndX} ${attachY + SOCKET_R}`,
    stroke: COMPONENT_STROKE, "stroke-width": 1.5, fill: "none",
  });
  app(parent, arc);

  drawText(parent, label, stickEndX - SOCKET_R - 4, attachY - SOCKET_R - 3, 9, "end");
}

// ─── relations ───────────────────────────────────────────────────────────────

function renderComponentRelation(
  parent: SvgEl,
  src: ComponentLayout,
  tgt: ComponentLayout,
  rel: UmlComponentRelation,
): void {
  const srcCX = src.x + src.width;
  const srcCY = src.y + src.height / 2;
  const tgtCX = tgt.x;
  const tgtCY = tgt.y + tgt.height / 2;

  drawRelLine(parent, srcCX, srcCY, tgtCX, tgtCY, true);

  if (rel.type === "realization") {
    drawTriArrow(parent, { x: srcCX, y: srcCY }, { x: tgtCX, y: tgtCY });
  } else {
    drawOpenArrow(parent, { x: srcCX, y: srcCY }, { x: tgtCX, y: tgtCY });
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
  atr(line, { x1, y1, x2, y2, stroke: COMPONENT_STROKE, "stroke-width": 1.5 });
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

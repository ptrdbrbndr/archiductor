/**
 * SequenceRenderer — SVG-renderer voor UML sequence diagrams.
 *
 * Rendert:
 *  - Lifelines: rechthoek boven + gestippelde lijn omlaag
 *  - Messages: horizontale pijlen met label en nummer
 *    - sync  → gevulde pijlpunt
 *    - async → open pijlpunt
 *    - return → gestippelde pijl
 *  - Activation boxes op actieve lifelines
 */

import type { UmlLifeline, UmlMessage, UmlSequenceDiagram } from "../types.js";
import {
  append as svgAppend,
  attr as svgAttr,
  create as svgCreate,
} from "tiny-svg";
import { computeSequenceLayout } from "../layout/sequenceLayout.js";

// ─── constants ────────────────────────────────────────────────────────────────

const LIFELINE_FILL = "#E8F5E9";
const LIFELINE_STROKE = "#555";
const DASHED_LINE_STROKE = "#999";
const MESSAGE_STROKE = "#333";
const ACTIVATION_FILL = "#C8E6C9";
const ACTIVATION_WIDTH = 10;
const ACTIVATION_HEIGHT_PAD = 30;
const FONT_FAMILY = "system-ui, sans-serif";
const FONT_SIZE = 11;
const ARROW_LENGTH = 10;
const ARROW_HALF_WIDTH = 5;
const LABEL_OFFSET_Y = -6;

// Tiny-svg returns Element from create() but types expect SVGElement — cast pattern identical to UmlRenderer
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

export function renderSequenceDiagram(
  parent: SVGElement,
  diagram: UmlSequenceDiagram,
): SVGElement {
  const { lifelines, messages } = diagram;
  const sorted = [...messages].sort((a, b) => a.order - b.order);
  const layout = computeSequenceLayout(lifelines, sorted);

  const group = el("g");
  atr(group, { class: "sequence-diagram" });

  renderLifelines(group, lifelines, layout.lifelines, layout.totalHeight);
  renderActivations(group, sorted, layout);
  renderMessages(group, sorted, layout.messages);

  app(parent as SvgEl, group);
  return group;
}

// ─── lifelines ────────────────────────────────────────────────────────────────

function renderLifelines(
  parent: SvgEl,
  lifelines: UmlLifeline[],
  layouts: ReturnType<typeof computeSequenceLayout>["lifelines"],
  totalHeight: number,
): void {
  for (const ll of lifelines) {
    const l = layouts.find((x) => x.id === ll.id);
    if (!l) continue;

    drawRect(parent, l.x, l.y, l.width, l.headerHeight, LIFELINE_FILL, LIFELINE_STROKE);
    drawText(parent, ll.name, l.centerX, l.y + l.headerHeight / 2 + 5, FONT_SIZE, "middle", true);
    drawDashedLine(parent, l.centerX, l.y + l.headerHeight, l.centerX, l.y + totalHeight);
  }
}

// ─── activation boxes ─────────────────────────────────────────────────────────

function renderActivations(
  parent: SvgEl,
  messages: UmlMessage[],
  layout: ReturnType<typeof computeSequenceLayout>,
): void {
  const activeFrom = new Map<string, number>();

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg) continue;
    const msgLayout = layout.messages[i];
    if (!msgLayout) continue;

    if (msg.type === "sync" || msg.type === "create") {
      if (!activeFrom.has(msg.to)) {
        activeFrom.set(msg.to, msgLayout.y);
      }
    }

    if (msg.type === "return" || msg.type === "destroy") {
      const startY = activeFrom.get(msg.from);
      if (startY !== undefined) {
        const ll = layout.lifelines.find((x) => x.id === msg.from);
        if (ll) {
          drawActivationBox(parent, ll.centerX, startY, msgLayout.y - startY + ACTIVATION_HEIGHT_PAD);
        }
        activeFrom.delete(msg.from);
      }
    }
  }

  for (const [lifelineId, startY] of activeFrom) {
    const ll = layout.lifelines.find((x) => x.id === lifelineId);
    if (ll) {
      drawActivationBox(parent, ll.centerX, startY, layout.totalHeight - startY - 20);
    }
  }
}

function drawActivationBox(parent: SvgEl, centerX: number, y: number, height: number): void {
  drawRect(
    parent,
    centerX - ACTIVATION_WIDTH / 2,
    y,
    ACTIVATION_WIDTH,
    Math.max(height, 10),
    ACTIVATION_FILL,
    LIFELINE_STROKE,
  );
}

// ─── messages ────────────────────────────────────────────────────────────────

function renderMessages(
  parent: SvgEl,
  messages: UmlMessage[],
  layouts: ReturnType<typeof computeSequenceLayout>["messages"],
): void {
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const msgLayout = layouts[i];
    if (!msg || !msgLayout) continue;

    const isDashed = msg.type === "return";
    const isSync = msg.type === "sync" || msg.type === "create";

    drawMessageLine(parent, msgLayout.fromX, msgLayout.y, msgLayout.toX, msgLayout.y, isDashed);
    drawMessageArrow(parent, msgLayout.toX, msgLayout.y, msgLayout.fromX < msgLayout.toX, isSync);

    const labelX = (msgLayout.fromX + msgLayout.toX) / 2;
    drawText(parent, `${i + 1}: ${msg.label}`, labelX, msgLayout.y + LABEL_OFFSET_Y, FONT_SIZE, "middle");
  }
}

function drawMessageLine(
  parent: SvgEl,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  dashed: boolean,
): void {
  const line = el("line");
  atr(line, {
    x1, y1, x2, y2,
    stroke: MESSAGE_STROKE,
    "stroke-width": 1.5,
    ...(dashed ? { "stroke-dasharray": "6 4" } : {}),
  });
  app(parent, line);
}

function drawMessageArrow(
  parent: SvgEl,
  tipX: number,
  tipY: number,
  goingRight: boolean,
  filled: boolean,
): void {
  const dir = goingRight ? -1 : 1;
  const baseX = tipX + dir * ARROW_LENGTH;
  const topY = tipY - ARROW_HALF_WIDTH;
  const botY = tipY + ARROW_HALF_WIDTH;

  const arrow = el("path");
  atr(arrow, {
    d: `M ${tipX} ${tipY} L ${baseX} ${topY} L ${baseX} ${botY} Z`,
    stroke: MESSAGE_STROKE,
    "stroke-width": 1.5,
    fill: filled ? MESSAGE_STROKE : "none",
  });
  app(parent, arrow);
}

// ─── SVG primitives ───────────────────────────────────────────────────────────

function drawRect(
  parent: SvgEl,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
): void {
  const rect = el("rect");
  atr(rect, { x, y, width: w, height: h, fill, stroke, "stroke-width": 1 });
  app(parent, rect);
}

function drawDashedLine(
  parent: SvgEl,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  const line = el("line");
  atr(line, { x1, y1, x2, y2, stroke: DASHED_LINE_STROKE, "stroke-width": 1, "stroke-dasharray": "4 4" });
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

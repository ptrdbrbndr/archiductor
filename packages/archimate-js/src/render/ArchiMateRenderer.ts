/**
 * ArchiMateRenderer — custom diagram-js BaseRenderer voor ArchiMate-shapes en
 * -connections.
 *
 * In M1 wordt dit uitgebreid naar 7 lagen + 11 connection-types per de
 * ArchiMate 3.2 + 4.0 spec.
 *
 * Status M1-week-1: skeleton met laag-kleuren-tabel + placeholder draw-methods
 * geporteerd uit `/archiductor/spike` (commit fde332c in archiductus.nl).
 */

import BaseRenderer from "diagram-js/lib/draw/BaseRenderer.js";
import {
  append as svgAppend,
  attr as svgAttr,
  create as svgCreate,
} from "tiny-svg";

import type { ArchiLayer } from "../types.js";

interface DiagramElement {
  width: number;
  height: number;
  businessObject?: {
    archimateType?: string;
    layer?: ArchiLayer;
    name?: string;
  };
}

interface DiagramConnection {
  waypoints?: { x: number; y: number }[];
  businessObject?: {
    archimateType?: string;
  };
}

/** ArchiMate 4.0 standaard laag-kleuren (Body fill / Stroke). */
const LAYER_COLORS: Record<ArchiLayer, { fill: string; stroke: string }> = {
  business: { fill: "#FFFFCC", stroke: "#999000" },
  application: { fill: "#CCFFFF", stroke: "#005580" },
  technology: { fill: "#CCFFCC", stroke: "#006633" },
  motivation: { fill: "#E5CCFF", stroke: "#5A2E99" },
  strategy: { fill: "#F4CCCC", stroke: "#993333" },
  physical: { fill: "#FFE5CC", stroke: "#995A33" },
  implementation: { fill: "#FFD9F0", stroke: "#993366" },
};

const CONNECTION_STROKE = "#222";

export class ArchiMateRenderer extends BaseRenderer {
  static $inject = ["eventBus"];

  constructor(eventBus: unknown) {
    // Priority 2000 — overrides default DefaultRenderer (priority 1000).
    super(eventBus as never, 2000);
  }

  override canRender(): boolean {
    return true;
  }

  override drawShape(parentNode: SVGElement, element: DiagramElement) {
    const archi = element.businessObject ?? {};
    const layer: ArchiLayer = archi.layer ?? "business";
    const colors = LAYER_COLORS[layer];

    const rect = svgCreate("rect");
    svgAttr(rect, {
      x: 0,
      y: 0,
      width: element.width,
      height: element.height,
      rx: 6,
      ry: 6,
      fill: colors.fill,
      stroke: colors.stroke,
      "stroke-width": 1.5,
    });
    svgAppend(parentNode, rect);

    if (archi.name) {
      const text = svgCreate("text");
      svgAttr(text, {
        x: element.width / 2,
        y: element.height / 2 + 4,
        "text-anchor": "middle",
        "font-family": "system-ui, sans-serif",
        "font-size": "13",
        fill: "#222",
      });
      text.textContent = archi.name;
      svgAppend(parentNode, text);
    }

    return rect as unknown as SVGElement;
  }

  override drawConnection(parentNode: SVGElement, connection: DiagramConnection) {
    const waypoints = connection.waypoints ?? [];
    const path = svgCreate("path");
    const d = waypoints
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ");
    svgAttr(path, {
      d,
      stroke: CONNECTION_STROKE,
      "stroke-width": 1.5,
      fill: "none",
    });
    svgAppend(parentNode, path);
    return path as unknown as SVGElement;
  }
}

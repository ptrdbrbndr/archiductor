/**
 * ArchiMateRenderer — custom diagram-js BaseRenderer voor ArchiMate-shapes en
 * -connections.
 *
 * M1-week-1: 7 laag-kleuren + 11 connection-types met juiste ArchiMate-markers.
 * Element-type-markers per element (BusinessProcess arrow, Component plug, etc.)
 * komen in M1-week-2 als follow-up zodra dit groen is in browser.
 *
 * Referenties:
 *  - ArchiMate 4.0 Notation Overview — Appendix B
 *  - bpmn-js BpmnRenderer als referentie voor diagram-js DI-patroon
 */

import BaseRenderer from "diagram-js/lib/draw/BaseRenderer.js";
import {
  append as svgAppend,
  attr as svgAttr,
  create as svgCreate,
} from "tiny-svg";

import type { ArchiLayer, ArchiRelationshipType } from "../types.js";

interface DiagramElement {
  width: number;
  height: number;
  businessObject?: {
    archimateType?: string;
    layer?: ArchiLayer;
    name?: string;
  };
}

interface Waypoint {
  x: number;
  y: number;
}

interface DiagramConnection {
  waypoints?: Waypoint[];
  businessObject?: {
    archimateType?: ArchiRelationshipType | string;
  };
}

/**
 * ArchiMate 4.0 standaard laag-kleuren (Body fill / Stroke).
 * Hex-waarden uit de ArchiMate 4.0 notation appendix.
 */
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

    const archimateType = (connection.businessObject?.archimateType ??
      "Association") as ArchiRelationshipType | string;

    // Hoofdlijn: dashed voor Flow + Influence, solid voor de rest.
    const isDashed = archimateType === "Flow" || archimateType === "Influence";
    const path = svgCreate("path");
    svgAttr(path, {
      d: waypoints
        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
        .join(" "),
      stroke: CONNECTION_STROKE,
      "stroke-width": 1.5,
      fill: "none",
      ...(isDashed ? { "stroke-dasharray": "6 4" } : {}),
    });
    svgAppend(parentNode, path);

    const start = waypoints[0];
    const next = waypoints[1];
    if (start && next) {
      this.drawSourceMarker(parentNode, archimateType, start, next);
    }

    const end = waypoints[waypoints.length - 1];
    const prev = waypoints[waypoints.length - 2];
    if (end && prev) {
      this.drawTargetMarker(parentNode, archimateType, prev, end);
    }

    if (archimateType === "Influence") {
      const mid = midpoint(waypoints);
      const label = svgCreate("text");
      svgAttr(label, {
        x: mid.x,
        y: mid.y - 6,
        "text-anchor": "middle",
        "font-family": "system-ui, sans-serif",
        "font-size": "12",
        "font-weight": "bold",
        fill: CONNECTION_STROKE,
      });
      label.textContent = "+";
      svgAppend(parentNode, label);
    }

    return path as unknown as SVGElement;
  }

  /**
   * Source-side markers — alleen Composition (filled diamond) en Aggregation
   * (hollow diamond) per ArchiMate-spec. Assignment heeft een dot aan source
   * (afgehandeld in drawTargetMarker via een aparte case).
   */
  private drawSourceMarker(
    parent: SVGElement,
    type: ArchiRelationshipType | string,
    start: Waypoint,
    next: Waypoint,
  ): void {
    const { ux, uy, nx, ny } = unitAndNormal(start, next);

    if (type === "Composition" || type === "Aggregation") {
      const tip = start;
      const back = { x: start.x + ux * 14, y: start.y + uy * 14 };
      const left = {
        x: start.x + ux * 7 + nx * 5,
        y: start.y + uy * 7 + ny * 5,
      };
      const right = {
        x: start.x + ux * 7 - nx * 5,
        y: start.y + uy * 7 - ny * 5,
      };
      const diamond = svgCreate("path");
      svgAttr(diamond, {
        d: `M ${tip.x} ${tip.y} L ${left.x} ${left.y} L ${back.x} ${back.y} L ${right.x} ${right.y} Z`,
        stroke: CONNECTION_STROKE,
        "stroke-width": 1.5,
        fill: type === "Composition" ? CONNECTION_STROKE : "#FFFFFF",
      });
      svgAppend(parent, diamond);
      return;
    }

    if (type === "Assignment") {
      const dot = svgCreate("circle");
      svgAttr(dot, {
        cx: start.x,
        cy: start.y,
        r: 4,
        fill: CONNECTION_STROKE,
      });
      svgAppend(parent, dot);
      return;
    }
  }

  /**
   * Target-side markers — varieert per ArchiMate-type:
   *  - Assignment: open arrow target
   *  - Realization, Specialization: open triangle
   *  - Triggering, Flow: filled arrow
   *  - Influence, Access: open arrow
   *  - UsedBy: hollow open V (chevron)
   *  - Association, Composition, Aggregation: geen target-marker
   */
  private drawTargetMarker(
    parent: SVGElement,
    type: ArchiRelationshipType | string,
    prev: Waypoint,
    end: Waypoint,
  ): void {
    if (type === "Association") return;
    if (type === "Composition" || type === "Aggregation") return;

    const { ux, uy, nx, ny } = unitAndNormal(prev, end);

    switch (type) {
      case "Realization":
      case "Specialization": {
        const tip = end;
        const base1 = {
          x: end.x - ux * 12 + nx * 7,
          y: end.y - uy * 12 + ny * 7,
        };
        const base2 = {
          x: end.x - ux * 12 - nx * 7,
          y: end.y - uy * 12 - ny * 7,
        };
        const tri = svgCreate("path");
        svgAttr(tri, {
          d: `M ${tip.x} ${tip.y} L ${base1.x} ${base1.y} L ${base2.x} ${base2.y} Z`,
          stroke: CONNECTION_STROKE,
          "stroke-width": 1.5,
          fill: "#FFFFFF",
        });
        svgAppend(parent, tri);
        return;
      }
      case "Triggering":
      case "Flow": {
        appendFilledArrow(parent, end, ux, uy, nx, ny);
        return;
      }
      case "Assignment":
      case "Influence":
      case "Access": {
        appendOpenArrow(parent, end, ux, uy, nx, ny);
        return;
      }
      case "UsedBy": {
        const left = {
          x: end.x - ux * 12 + nx * 7,
          y: end.y - uy * 12 + ny * 7,
        };
        const right = {
          x: end.x - ux * 12 - nx * 7,
          y: end.y - uy * 12 - ny * 7,
        };
        const v = svgCreate("path");
        svgAttr(v, {
          d: `M ${left.x} ${left.y} L ${end.x} ${end.y} L ${right.x} ${right.y}`,
          stroke: CONNECTION_STROKE,
          "stroke-width": 1.5,
          fill: "none",
        });
        svgAppend(parent, v);
        return;
      }
      default:
        return;
    }
  }
}

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
  if (waypoints.length === 1) {
    const wp = waypoints[0];
    return wp ? { ...wp } : { x: 0, y: 0 };
  }
  const midIndex = Math.floor(waypoints.length / 2);
  const a = waypoints[midIndex - 1];
  const b = waypoints[midIndex];
  if (!a || !b) return waypoints[0] ?? { x: 0, y: 0 };
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function appendFilledArrow(
  parent: SVGElement,
  tip: Waypoint,
  ux: number,
  uy: number,
  nx: number,
  ny: number,
): void {
  const left = {
    x: tip.x - ux * 10 + nx * 4,
    y: tip.y - uy * 10 + ny * 4,
  };
  const right = {
    x: tip.x - ux * 10 - nx * 4,
    y: tip.y - uy * 10 - ny * 4,
  };
  const arrow = svgCreate("path");
  svgAttr(arrow, {
    d: `M ${tip.x} ${tip.y} L ${left.x} ${left.y} L ${right.x} ${right.y} Z`,
    fill: CONNECTION_STROKE,
    stroke: CONNECTION_STROKE,
    "stroke-width": 1,
  });
  svgAppend(parent, arrow);
}

function appendOpenArrow(
  parent: SVGElement,
  tip: Waypoint,
  ux: number,
  uy: number,
  nx: number,
  ny: number,
): void {
  const left = {
    x: tip.x - ux * 10 + nx * 4,
    y: tip.y - uy * 10 + ny * 4,
  };
  const right = {
    x: tip.x - ux * 10 - nx * 4,
    y: tip.y - uy * 10 - ny * 4,
  };
  const arrow = svgCreate("path");
  svgAttr(arrow, {
    d: `M ${tip.x} ${tip.y} L ${left.x} ${left.y} L ${right.x} ${right.y} Z`,
    fill: "#FFFFFF",
    stroke: CONNECTION_STROKE,
    "stroke-width": 1.5,
  });
  svgAppend(parent, arrow);
}

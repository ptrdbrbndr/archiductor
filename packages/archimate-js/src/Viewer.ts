/**
 * Viewer — public API entry point voor read-only ArchiMate-rendering.
 *
 * Volgt het patroon van bpmn-js' Viewer (https://github.com/bpmn-io/bpmn-js):
 *  - Constructor neemt opties en construeert intern een diagram-js Diagram
 *  - importXML() parseert OEF en hydrateert canvas
 *  - get(name) exposeert diagram-js services voor advanced gebruik
 *  - destroy() ruimt event-listeners en DOM op
 */

import Diagram from "diagram-js";
import ZoomScrollModule from "diagram-js/lib/navigation/zoomscroll/index.js";
import MoveCanvasModule from "diagram-js/lib/navigation/movecanvas/index.js";

import { parseOpenExchange } from "./parse/index.js";
import { renderModule } from "./render/index.js";
import type {
  ArchiElement,
  ArchiModel,
  ArchiRelationship,
  ArchiView,
} from "./types.js";

export interface ViewerOptions {
  /** DOM element of CSS selector that hosts the canvas. */
  container: HTMLElement | string;
  /** Additional diagram-js modules to load. Useful for plug-in features. */
  additionalModules?: unknown[];
}

interface DiagramCanvas {
  setRootElement: (root: { id: string }) => void;
  addShape: (shape: unknown, parent?: unknown) => unknown;
  addConnection: (connection: unknown, parent?: unknown) => unknown;
  getRootElement: () => unknown;
  zoom: (level: "fit-viewport" | number) => unknown;
}

interface DiagramElementFactory {
  createShape: (props: Record<string, unknown>) => {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  createConnection: (props: Record<string, unknown>) => unknown;
}

export class Viewer {
  private diagram: Diagram;
  private model: ArchiModel | null = null;

  constructor(options: ViewerOptions) {
    const container = resolveContainer(options.container);
    this.diagram = new Diagram({
      canvas: { container },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      modules: [
        renderModule,
        ZoomScrollModule,
        MoveCanvasModule,
        ...(options.additionalModules ?? []),
      ] as any,
    });
  }

  /**
   * Parse an Open Exchange Format XML string and render the first view.
   * If the model has multiple views, only the first is rendered. Use
   * `setView(viewId)` to switch (M1.1).
   */
  async importXML(xml: string): Promise<void> {
    const model = parseOpenExchange(xml);
    this.model = model;
    this.renderModel(model);
  }

  /** Re-render the currently loaded model. */
  refresh(): void {
    if (this.model) this.renderModel(this.model);
  }

  /** Access the underlying diagram-js services (canvas, eventBus, etc.). */
  get<T>(serviceName: string): T {
    return this.diagram.get<T>(serviceName);
  }

  /** Tear down the viewer and free DOM resources. */
  destroy(): void {
    this.diagram.destroy();
  }

  /**
   * Render de eerste view van het model op canvas.
   *
   * - Maakt voor elke view-node een diagram-js shape met x/y/w/h en business-
   *   object dat de bijbehorende ArchiElement-data bevat (renderer leest dit
   *   in `ArchiMateRenderer.drawShape` voor laag-styling en type-marker).
   * - Maakt voor elke view-connection een diagram-js connection met source +
   *   target shape-references en waypoints (start = source-right-center, dan
   *   bendpoints uit de model, dan end = target-left-center).
   * - View met 0 nodes / multiple views: M1.1+ feature; M1-week-1 rendert
   *   alleen views[0].
   */
  private renderModel(model: ArchiModel): void {
    if (model.views.length === 0) return;
    const view = model.views[0];
    if (!view) return;

    const canvas = this.diagram.get<DiagramCanvas>("canvas");
    const elementFactory =
      this.diagram.get<DiagramElementFactory>("elementFactory");

    canvas.setRootElement({ id: `root-${view.id}` });

    const elementById = new Map<string, ArchiElement>(
      model.elements.map((e) => [e.id, e]),
    );
    const relationshipById = new Map<string, ArchiRelationship>(
      model.relationships.map((r) => [r.id, r]),
    );

    const shapeByNodeId = new Map<
      string,
      { x: number; y: number; width: number; height: number }
    >();

    for (const node of view.nodes) {
      const element = elementById.get(node.elementRef);
      const shape = elementFactory.createShape({
        id: node.id,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        businessObject: {
          elementId: node.elementRef,
          archimateType: element?.type ?? "BusinessProcess",
          layer: element?.layer ?? "business",
          name: element?.name ?? "",
          documentation: element?.documentation,
        },
      });
      canvas.addShape(shape);
      shapeByNodeId.set(node.id, shape);
    }

    for (const conn of view.connections) {
      const source = shapeByNodeId.get(conn.sourceNodeRef);
      const target = shapeByNodeId.get(conn.targetNodeRef);
      if (!source || !target) continue;

      const relationship = relationshipById.get(conn.relationshipRef);

      const start = {
        x: source.x + source.width,
        y: source.y + source.height / 2,
      };
      const end = { x: target.x, y: target.y + target.height / 2 };
      const waypoints = [start, ...conn.bendpoints, end];

      const connection = elementFactory.createConnection({
        id: conn.id,
        source,
        target,
        waypoints,
        businessObject: {
          relationshipId: conn.relationshipRef,
          archimateType: relationship?.type ?? "Association",
          name: relationship?.name,
        },
      });
      canvas.addConnection(connection);
    }
  }

  /**
   * Geeft het laatst geladen model terug (of `null` als er nog geen import is).
   * Bedoeld voor tests en consumer-introspection; niet voor mutaties.
   */
  getModel(): ArchiModel | null {
    return this.model;
  }
}

function resolveContainer(c: HTMLElement | string): HTMLElement {
  if (typeof c !== "string") return c;
  const el = typeof document !== "undefined" ? document.querySelector(c) : null;
  if (!el) throw new Error(`Viewer container not found: ${c}`);
  return el as HTMLElement;
}

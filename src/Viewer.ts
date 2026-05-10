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

import { renderModule } from "./render/index.js";
import { parseOpenExchange } from "./parse/index.js";
import type { ArchiModel } from "./types.js";

export interface ViewerOptions {
  /** DOM element of CSS selector that hosts the canvas. */
  container: HTMLElement | string;
  /** Additional diagram-js modules to load. Useful for plug-in features. */
  additionalModules?: unknown[];
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

  private renderModel(model: ArchiModel): void {
    // TODO M1: render eerste view in canvas via elementFactory + addShape/addConnection.
    // Tijdens skeleton: geen-op zodat de import niet faalt voor consumers.
    void model;
  }
}

function resolveContainer(c: HTMLElement | string): HTMLElement {
  if (typeof c !== "string") return c;
  const el = typeof document !== "undefined" ? document.querySelector(c) : null;
  if (!el) throw new Error(`Viewer container not found: ${c}`);
  return el as HTMLElement;
}

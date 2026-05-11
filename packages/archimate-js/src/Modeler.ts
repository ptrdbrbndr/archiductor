/**
 * Modeler — read/write ArchiMate-rendering met palette, command-stack en
 * keyboard-shortcuts. M4-a minimum-viable: element-create via palette + save
 * via `exportModel()`. Element-properties bewerken, relations, undo/redo en
 * delete komen in M4-b / M4-c.
 *
 * Volgt het patroon van bpmn-js' Modeler (https://github.com/bpmn-io/bpmn-js).
 */

import Diagram from "diagram-js";
import ZoomScrollModule from "diagram-js/lib/navigation/zoomscroll/index.js";
import MoveCanvasModule from "diagram-js/lib/navigation/movecanvas/index.js";
import ModelingModule from "diagram-js/lib/features/modeling/index.js";
import SelectionModule from "diagram-js/lib/features/selection/index.js";
import MoveModule from "diagram-js/lib/features/move/index.js";
import OutlineModule from "diagram-js/lib/features/outline/index.js";
import CreateModule from "diagram-js/lib/features/create/index.js";
import ConnectModule from "diagram-js/lib/features/connect/index.js";
import ContextPadModule from "diagram-js/lib/features/context-pad/index.js";
import PaletteModule from "diagram-js/lib/features/palette/index.js";
import KeyboardModule from "diagram-js/lib/features/keyboard/index.js";
import RulesModule from "diagram-js/lib/features/rules/index.js";

import { renderModule } from "./render/index.js";
import { paletteModule } from "./palette/index.js";
import { contextPadModule } from "./context-pad/index.js";
import { archimateModelingModule } from "./modeling/index.js";
import { parseOpenExchange } from "./parse/index.js";
import { detectLayer } from "./archimate-layers.js";
import type {
  ArchiElement,
  ArchiModel,
  ArchiRelationship,
  ArchiRelationshipType,
  ArchiView,
  ArchiViewConnection,
  ArchiViewNode,
  ArchiLayer,
} from "./types.js";

export interface ModelerOptions {
  /** DOM element of CSS selector dat het canvas host. */
  container: HTMLElement | string;
  /** Extra diagram-js modules — bv. minimap of custom rules. */
  additionalModules?: unknown[];
}

interface DiagramShape {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  businessObject?: {
    elementId?: string;
    archimateType?: string;
    layer?: ArchiLayer;
    name?: string;
    documentation?: string;
  };
}

interface DiagramConnection {
  id: string;
  source: DiagramShape;
  target: DiagramShape;
  waypoints: { x: number; y: number }[];
  businessObject?: {
    relationshipId?: string;
    archimateType?: ArchiRelationshipType;
    name?: string;
  };
}

interface DiagramCanvas {
  setRootElement: (root: { id: string; children?: unknown[] }) => void;
  addShape: (shape: unknown, parent?: unknown) => unknown;
  addConnection: (connection: unknown, parent?: unknown) => unknown;
  getRootElement: () => { id?: string };
  zoom: (level: "fit-viewport" | number) => unknown;
}

interface DiagramElementFactory {
  createShape: (props: Record<string, unknown>) => DiagramShape;
  createConnection: (props: Record<string, unknown>) => DiagramConnection;
}

interface DiagramElementRegistry {
  getAll: () => Array<DiagramShape | DiagramConnection | { id: string }>;
}

interface DiagramEventBus {
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  off: (event: string, callback: (...args: unknown[]) => void) => void;
}

export class Modeler {
  private diagram: Diagram;
  private model: ArchiModel | null = null;
  private currentViewId: string | null = null;
  private options: ModelerOptions;

  constructor(options: ModelerOptions) {
    this.options = options;
    const container = resolveContainer(options.container);

    const modules: unknown[] = [
      renderModule,
      ZoomScrollModule,
      MoveCanvasModule,
      SelectionModule,
      OutlineModule,
      MoveModule,
      RulesModule,
      ModelingModule,
      archimateModelingModule,
      CreateModule,
      ConnectModule,
      ContextPadModule,
      contextPadModule,
      PaletteModule,
      paletteModule,
      KeyboardModule,
    ];
    if (options.additionalModules) modules.push(...options.additionalModules);

    this.diagram = new Diagram({
      canvas: { container },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      modules: modules as any,
    });
  }

  /** Importeer een OEF-XML-string + render de eerste view. */
  async importXML(xml: string): Promise<void> {
    const model = parseOpenExchange(xml);
    this.model = model;
    this.renderModel(model);
  }

  /**
   * Reconstrueer een ArchiModel uit de huidige canvas-state. Roept de bestaande
   * elements/relationships door (om properties + documentation te bewaren) en
   * herschrijft alleen de view-nodes/connections + nieuwe elements die via
   * palette zijn toegevoegd.
   *
   * Reden voor de pass-through: M4-a-palette voegt elements toe maar wijzigt
   * geen bestaande element-data; pas in M4-b komt PropertiesPane-edit waarbij
   * we hier de bewerkingen oogsten.
   */
  exportModel(): ArchiModel {
    if (!this.model) throw new Error("Modeler heeft geen model geladen");

    const elementRegistry =
      this.diagram.get<DiagramElementRegistry>("elementRegistry");
    const all = elementRegistry.getAll();

    const shapes = all.filter(isShape);
    const connections = all.filter(isConnection);

    // Hergebruik bestaande elements + relationships als source-of-truth; nieuwe
    // shapes met `businessObject.elementId` die niet in model.elements zitten
    // worden toegevoegd. View-nodes/connections worden volledig vervangen door
    // de canvas-state.
    const existingElementsById = new Map(this.model.elements.map((e) => [e.id, e]));
    const existingRelationshipsById = new Map(
      this.model.relationships.map((r) => [r.id, r]),
    );

    const elements: ArchiElement[] = [...this.model.elements];
    const relationships: ArchiRelationship[] = [...this.model.relationships];

    const viewNodes: ArchiViewNode[] = [];
    const viewConnections: ArchiViewConnection[] = [];

    for (const shape of shapes) {
      const bo = shape.businessObject;
      if (!bo) continue;
      const elementId = bo.elementId ?? `el-${shape.id}`;

      if (!existingElementsById.has(elementId)) {
        const archimateType = bo.archimateType ?? "BusinessObject";
        elements.push({
          id: elementId,
          name: bo.name ?? archimateType,
          type: archimateType,
          layer: bo.layer ?? detectLayer(archimateType),
          documentation: bo.documentation,
        });
        existingElementsById.set(elementId, elements[elements.length - 1]!);
      }

      viewNodes.push({
        id: shape.id,
        elementRef: elementId,
        x: Math.round(shape.x),
        y: Math.round(shape.y),
        width: Math.round(shape.width),
        height: Math.round(shape.height),
      });
    }

    for (const conn of connections) {
      const bo = conn.businessObject;
      const relationshipId = bo?.relationshipId ?? `rel-${conn.id}`;

      // Source/target ArchiElement-ids ophalen via shape-businessObjects
      const sourceBo = conn.source.businessObject;
      const targetBo = conn.target.businessObject;
      const sourceElementId = sourceBo?.elementId ?? `el-${conn.source.id}`;
      const targetElementId = targetBo?.elementId ?? `el-${conn.target.id}`;

      if (!existingRelationshipsById.has(relationshipId)) {
        relationships.push({
          id: relationshipId,
          type: bo?.archimateType ?? "Association",
          source: sourceElementId,
          target: targetElementId,
          name: bo?.name,
        });
        existingRelationshipsById.set(
          relationshipId,
          relationships[relationships.length - 1]!,
        );
      }

      // Strip de auto-berekende start/end waypoints (renderer berekent ze opnieuw)
      const middleBendpoints = conn.waypoints.slice(1, -1).map((w) => ({
        x: Math.round(w.x),
        y: Math.round(w.y),
      }));

      viewConnections.push({
        id: conn.id,
        relationshipRef: relationshipId,
        sourceNodeRef: conn.source.id,
        targetNodeRef: conn.target.id,
        bendpoints: middleBendpoints,
      });
    }

    const currentView: ArchiView = this.model.views[0]
      ? {
          ...this.model.views[0],
          nodes: viewNodes,
          connections: viewConnections,
        }
      : {
          id: this.currentViewId ?? "view-1",
          name: "Default View",
          nodes: viewNodes,
          connections: viewConnections,
        };

    return {
      ...this.model,
      elements,
      relationships,
      views: [currentView, ...this.model.views.slice(1)],
    };
  }

  /** Subscribe op commandStack.changed (en andere diagram-js events). */
  on(event: string, callback: (...args: unknown[]) => void): void {
    const eventBus = this.diagram.get<DiagramEventBus>("eventBus");
    eventBus.on(event, callback);
  }

  off(event: string, callback: (...args: unknown[]) => void): void {
    const eventBus = this.diagram.get<DiagramEventBus>("eventBus");
    eventBus.off(event, callback);
  }

  get<T>(serviceName: string): T {
    return this.diagram.get<T>(serviceName);
  }

  destroy(): void {
    this.diagram.destroy();
  }

  getModel(): ArchiModel | null {
    return this.model;
  }

  private renderModel(model: ArchiModel): void {
    if (model.views.length === 0) return;
    const view = model.views[0];
    if (!view) return;

    this.currentViewId = view.id;
    const canvas = this.diagram.get<DiagramCanvas>("canvas");
    const elementFactory =
      this.diagram.get<DiagramElementFactory>("elementFactory");

    canvas.setRootElement({ id: `root-${view.id}`, children: [] });

    const elementById = new Map<string, ArchiElement>(
      model.elements.map((e) => [e.id, e]),
    );
    const relationshipById = new Map<string, ArchiRelationship>(
      model.relationships.map((r) => [r.id, r]),
    );

    const shapeByNodeId = new Map<string, DiagramShape>();

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
}

function isShape(
  el: DiagramShape | DiagramConnection | { id: string },
): el is DiagramShape {
  return (
    typeof (el as DiagramShape).width === "number" &&
    typeof (el as DiagramShape).height === "number" &&
    !(el as DiagramConnection).waypoints
  );
}

function isConnection(
  el: DiagramShape | DiagramConnection | { id: string },
): el is DiagramConnection {
  return Array.isArray((el as DiagramConnection).waypoints);
}

function resolveContainer(c: HTMLElement | string): HTMLElement {
  if (typeof c !== "string") return c;
  const el = typeof document !== "undefined" ? document.querySelector(c) : null;
  if (!el) throw new Error(`Modeler container not found: ${c}`);
  return el as HTMLElement;
}

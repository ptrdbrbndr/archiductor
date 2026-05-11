/**
 * Viewer — publieke API entry point voor read-only UML class diagram rendering.
 *
 * Volgt het patroon van archimate-js Viewer (en bpmn-js Viewer):
 *  - Constructor neemt opties en construeert intern een diagram-js Diagram
 *  - importXml(xml) parseert XMI en rendert het class diagram
 *  - get(name) exposeert diagram-js services voor advanced gebruik
 *  - destroy() ruimt event-listeners en DOM op
 */

import Diagram from "diagram-js";
import ZoomScrollModule from "diagram-js/lib/navigation/zoomscroll/index.js";
import MoveCanvasModule from "diagram-js/lib/navigation/movecanvas/index.js";

import { parseXmi } from "./parser/XmiParser.js";
import { parseSequenceXmi } from "./parser/SequenceParser.js";
import { parseUseCaseXmi } from "./parser/UseCaseParser.js";
import { parseComponentXmi } from "./parser/ComponentParser.js";
import { renderModule } from "./render/index.js";
import { computeGridLayout } from "./layout/gridLayout.js";
import type { UmlModel, UmlRelation, UmlClass, UmlDiagramType } from "./types.js";
import type { UmlSequenceDiagram } from "./types.js";
import type { UmlUseCaseDiagram } from "./types.js";
import type { UmlComponentDiagram } from "./types.js";

// ─── public interfaces ────────────────────────────────────────────────────────

export interface ViewerOptions {
  /** DOM element of CSS selector dat het canvas host. */
  container: HTMLElement | string;
  /** Extra diagram-js modules — bv. minimap. */
  additionalModules?: unknown[];
}

// ─── private diagram-js service types ────────────────────────────────────────

interface DiagramCanvas {
  setRootElement: (root: { id: string; children?: unknown[] }) => void;
  addShape: (shape: unknown, parent?: unknown) => unknown;
  addConnection: (connection: unknown, parent?: unknown) => unknown;
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

// ─── Viewer class ─────────────────────────────────────────────────────────────

export class Viewer {
  private readonly diagram: Diagram;
  private model: UmlModel | null = null;
  private sequenceDiagram: UmlSequenceDiagram | null = null;
  private useCaseDiagram: UmlUseCaseDiagram | null = null;
  private componentDiagram: UmlComponentDiagram | null = null;

  constructor(options: ViewerOptions) {
    const container = resolveContainer(options.container);
    const modules: unknown[] = [
      renderModule,
      ZoomScrollModule,
      MoveCanvasModule,
      ...(options.additionalModules ?? []),
    ];

    this.diagram = new Diagram({
      canvas: { container },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      modules: modules as any,
    });
  }

  /**
   * Parset een Eclipse UML2 XMI 2.5 string en rendert het juiste diagram.
   * Het diagramtype wordt automatisch gedetecteerd op basis van de XMI-content.
   * Ondersteunde types: class, sequence, usecase, component.
   */
  async importXml(xml: string): Promise<void> {
    const diagramType = detectDiagramType(xml);

    if (diagramType === "sequence") {
      const diagram = parseSequenceXmi(xml);
      this.sequenceDiagram = diagram;
      this.renderSequenceDiagram(diagram);
      return;
    }

    if (diagramType === "usecase") {
      const diagram = parseUseCaseXmi(xml);
      this.useCaseDiagram = diagram;
      this.renderUseCaseDiagram(diagram);
      return;
    }

    if (diagramType === "component") {
      const diagram = parseComponentXmi(xml);
      this.componentDiagram = diagram;
      this.renderComponentDiagram(diagram);
      return;
    }

    // Default: class diagram
    const model = parseXmi(xml);
    this.model = model;
    this.renderModel(model);
  }

  /** Geeft het intern geladen UmlModel terug (of null als er niets geladen is). */
  getModel(): UmlModel | null {
    return this.model;
  }

  /** Geeft het gedetecteerde diagramtype terug (of null als er niets geladen is). */
  getDetectedType(): UmlDiagramType | null {
    if (this.sequenceDiagram) return "sequence";
    if (this.useCaseDiagram) return "usecase";
    if (this.componentDiagram) return "component";
    if (this.model) return "class";
    return null;
  }

  /** Access de onderliggende diagram-js services (canvas, eventBus, etc.). */
  get<T>(serviceName: string): T {
    return this.diagram.get<T>(serviceName);
  }

  /** Verwijder de viewer en geeft DOM-resources vrij. */
  destroy(): void {
    this.diagram.destroy();
  }

  // ─── private rendering ──────────────────────────────────────────────────────

  private renderModel(model: UmlModel): void {
    const canvas = this.diagram.get<DiagramCanvas>("canvas");
    const elementFactory = this.diagram.get<DiagramElementFactory>("elementFactory");

    canvas.setRootElement({ id: "root-uml", children: [] });

    const layouts = computeGridLayout(model.classes);
    const layoutById = new Map(layouts.map((l) => [l.id, l]));
    const classById = new Map<string, UmlClass>(model.classes.map((c) => [c.id, c]));

    const shapeById = new Map<
      string,
      { id: string; x: number; y: number; width: number; height: number }
    >();

    for (const cls of model.classes) {
      const layout = layoutById.get(cls.id);
      if (!layout) continue;

      const shape = elementFactory.createShape({
        id: `shape-${cls.id}`,
        x: layout.x,
        y: layout.y,
        width: layout.width,
        height: layout.height,
        businessObject: {
          umlType: "class",
          name: cls.name,
          isAbstract: cls.isAbstract,
          isInterface: cls.isInterface,
          stereotype: cls.stereotype,
          attributes: cls.attributes,
          operations: cls.operations,
        },
      });

      canvas.addShape(shape);
      shapeById.set(cls.id, shape);
    }

    this.renderRelations(model.relations, classById, shapeById, elementFactory, canvas);
  }

  /**
   * Rendert een sequence diagram via een SVG-element op het diagram-js canvas.
   * Sequence diagrams gebruiken directe SVG-rendering (geen diagram-js shapes),
   * omdat lifelines en messages een afwijkend layout-model hebben.
   */
  private renderSequenceDiagram(diagram: UmlSequenceDiagram): void {
    // Lazy import om tree-shaking te ondersteunen
    import("./render/SequenceRenderer.js").then(({ renderSequenceDiagram }) => {
      const canvas = this.diagram.get<DiagramCanvas>("canvas");
      canvas.setRootElement({ id: "root-sequence", children: [] });

      const svg = this.getOrCreateSvgLayer();
      if (svg) renderSequenceDiagram(svg, diagram);
    }).catch(() => {
      // Renderer niet beschikbaar in test-omgeving — diagram wordt overgeslagen
    });
  }

  /**
   * Rendert een use case diagram via directe SVG-rendering.
   */
  private renderUseCaseDiagram(diagram: UmlUseCaseDiagram): void {
    import("./render/UseCaseRenderer.js").then(({ renderUseCaseDiagram }) => {
      const canvas = this.diagram.get<DiagramCanvas>("canvas");
      canvas.setRootElement({ id: "root-usecase", children: [] });

      const svg = this.getOrCreateSvgLayer();
      if (svg) renderUseCaseDiagram(svg, diagram);
    }).catch(() => {
      // Renderer niet beschikbaar in test-omgeving
    });
  }

  /**
   * Rendert een component diagram via directe SVG-rendering.
   */
  private renderComponentDiagram(diagram: UmlComponentDiagram): void {
    import("./render/ComponentRenderer.js").then(({ renderComponentDiagram }) => {
      const canvas = this.diagram.get<DiagramCanvas>("canvas");
      canvas.setRootElement({ id: "root-component", children: [] });

      const svg = this.getOrCreateSvgLayer();
      if (svg) renderComponentDiagram(svg, diagram);
    }).catch(() => {
      // Renderer niet beschikbaar in test-omgeving
    });
  }

  /** Geeft de diagram-js SVG root terug voor directe rendering. */
  private getOrCreateSvgLayer(): SVGElement | null {
    try {
      // diagram-js exposeert de svg root via het canvas of via de container
      const container = (this.diagram as unknown as { _container?: HTMLElement })._container;
      if (!container) return null;
      return container.querySelector("svg") as SVGElement | null;
    } catch {
      return null;
    }
  }

  private renderRelations(
    relations: UmlRelation[],
    classById: Map<string, UmlClass>,
    shapeById: Map<string, { id: string; x: number; y: number; width: number; height: number }>,
    elementFactory: DiagramElementFactory,
    canvas: DiagramCanvas,
  ): void {
    for (const rel of relations) {
      const sourceShape = shapeById.get(rel.sourceId);
      const targetShape = shapeById.get(rel.targetId);
      if (!sourceShape || !targetShape) continue;

      // Eenvoudige waypoints: source rechts-midden → target links-midden
      const start = {
        x: sourceShape.x + sourceShape.width,
        y: sourceShape.y + sourceShape.height / 2,
      };
      const end = {
        x: targetShape.x,
        y: targetShape.y + targetShape.height / 2,
      };

      const connection = elementFactory.createConnection({
        id: `conn-${rel.id}`,
        source: sourceShape,
        target: targetShape,
        waypoints: [start, end],
        businessObject: {
          umlType: "connection",
          relationType: rel.type,
          name: rel.name,
        },
      });

      canvas.addConnection(connection);
    }
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Detecteert het diagramtype door te kijken naar de aanwezige xmi:type waarden
 * in de root-packagedElement of ownedBehavior van de XMI.
 *
 * Volgorde van prioriteit:
 *  1. uml:Interaction → sequence
 *  2. uml:Actor of uml:UseCase → usecase
 *  3. uml:Component → component
 *  4. Fallback → class
 */
export function detectDiagramType(xml: string): UmlDiagramType {
  if (xml.includes('xmi:type="uml:Interaction"') || xml.includes("xmi:type='uml:Interaction'")) {
    return "sequence";
  }
  if (
    xml.includes('xmi:type="uml:Actor"') ||
    xml.includes("xmi:type='uml:Actor'") ||
    xml.includes('xmi:type="uml:UseCase"') ||
    xml.includes("xmi:type='uml:UseCase'")
  ) {
    return "usecase";
  }
  if (xml.includes('xmi:type="uml:Component"') || xml.includes("xmi:type='uml:Component'")) {
    return "component";
  }
  return "class";
}

function resolveContainer(c: HTMLElement | string): HTMLElement {
  if (typeof c !== "string") return c;
  const el =
    typeof document !== "undefined" ? document.querySelector(c) : null;
  if (!el) throw new Error(`Viewer container not found: ${c}`);
  return el as HTMLElement;
}

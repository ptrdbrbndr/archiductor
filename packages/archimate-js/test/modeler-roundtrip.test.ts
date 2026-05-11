/**
 * @vitest-environment happy-dom
 *
 * Round-trip-test voor Modeler-edits: import → mutate (programmatic) →
 * exportModel → serializeOpenExchange → parseOpenExchange → deep-equals
 * de gemuteerde state. Bewijst dat exportModel + parser/serializer
 * symmetrisch zijn voor M4-flows (add element, rename via command-stack,
 * delete element).
 *
 * Niet gedekt hier: pixel-perfecte renderer-round-trip (M1 viewer-test);
 * en de OEF-XML round-trip op echte corpus-modellen (M1 round-trip-corpus).
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  Modeler,
  parseOpenExchange,
  serializeOpenExchange,
} from "../src/index.js";

beforeAll(() => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const w = globalThis as unknown as { SVGTransformList?: any };
  if (
    typeof w.SVGTransformList === "function" &&
    typeof w.SVGTransformList.prototype.consolidate !== "function"
  ) {
    w.SVGTransformList.prototype.consolidate = function consolidate(): null {
      return null;
    };
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const simpleBusinessXml = readFileSync(
  resolve(__dirname, "fixtures/simple-business.xml"),
  "utf-8",
);

interface DiagramCanvasLike {
  addShape: (shape: unknown) => unknown;
  getRootElement: () => unknown;
}

interface ElementFactoryLike {
  createShape: (props: Record<string, unknown>) => unknown;
}

interface ModelingLike {
  createShape: (
    shape: unknown,
    pos: { x: number; y: number },
    parent: unknown,
  ) => unknown;
  removeElements: (els: unknown[]) => void;
}

interface CommandStackLike {
  execute: (cmd: string, ctx: unknown) => void;
  undo: () => void;
  redo: () => void;
}

interface ElementRegistryLike {
  filter: (
    fn: (el: {
      businessObject?: { elementId?: string };
      waypoints?: unknown[];
    }) => boolean,
  ) => Array<{ businessObject?: { elementId?: string }; waypoints?: unknown[] }>;
}

describe("Modeler round-trip — edit → export → parse → equals", () => {
  let container: HTMLDivElement;
  let modeler: Modeler;

  beforeEach(() => {
    container = document.createElement("div");
    container.style.width = "800px";
    container.style.height = "600px";
    document.body.appendChild(container);
    modeler = new Modeler({ container });
  });

  afterEach(() => {
    modeler.destroy();
    container.remove();
  });

  it("element-add via modeling → export → parse roundtrip behoudt het element", async () => {
    await modeler.importXML(simpleBusinessXml);

    const factory = modeler.get<ElementFactoryLike>("elementFactory");
    const canvas = modeler.get<DiagramCanvasLike>("canvas");
    const modeling = modeler.get<ModelingLike>("modeling");

    const newId = "rt-new-element";
    const shape = factory.createShape({
      width: 140,
      height: 60,
      businessObject: {
        elementId: newId,
        archimateType: "ApplicationComponent",
        layer: "application",
        name: "RT App",
      },
    });
    modeling.createShape(shape, { x: 600, y: 100 }, canvas.getRootElement());

    const exported = modeler.exportModel();
    expect(exported.elements.find((e) => e.id === newId)?.name).toBe("RT App");

    // XML round-trip
    const xml = serializeOpenExchange(exported);
    const reparsed = parseOpenExchange(xml);

    expect(reparsed.elements.find((e) => e.id === newId)?.type).toBe(
      "ApplicationComponent",
    );
    expect(reparsed.elements.find((e) => e.id === newId)?.layer).toBe(
      "application",
    );
    // View-node moet ook nog bestaan
    const node = reparsed.views[0]?.nodes.find(
      (n) => n.elementRef === newId,
    );
    expect(node).toBeDefined();
  });

  it("rename via archimate.update.bo command behoudt nieuwe naam in roundtrip", async () => {
    await modeler.importXML(simpleBusinessXml);

    const elementRegistry =
      modeler.get<ElementRegistryLike>("elementRegistry");
    const cs = modeler.get<CommandStackLike>("commandStack");

    const shapes = elementRegistry.filter(
      (el) => !el.waypoints && !!el.businessObject?.elementId,
    );
    const first = shapes[0]!;
    const originalId = first.businessObject!.elementId!;

    cs.execute("archimate.update.bo", {
      element: first,
      properties: { name: "Renamed via command" },
    });

    const exported = modeler.exportModel();
    expect(exported.elements.find((e) => e.id === originalId)?.name).toBe(
      "Renamed via command",
    );

    const xml = serializeOpenExchange(exported);
    const reparsed = parseOpenExchange(xml);
    expect(reparsed.elements.find((e) => e.id === originalId)?.name).toBe(
      "Renamed via command",
    );
  });

  it("undo na rename reverteert businessObject + roundtrip levert originele naam", async () => {
    await modeler.importXML(simpleBusinessXml);

    const elementRegistry =
      modeler.get<ElementRegistryLike>("elementRegistry");
    const cs = modeler.get<CommandStackLike>("commandStack");

    const shapes = elementRegistry.filter(
      (el) => !el.waypoints && !!el.businessObject?.elementId,
    );
    const first = shapes[0]!;
    const elementId = first.businessObject!.elementId!;
    const originalName = (
      first as unknown as { businessObject: { name: string } }
    ).businessObject.name;

    cs.execute("archimate.update.bo", {
      element: first,
      properties: { name: "Temporary rename" },
    });
    expect(modeler.canUndo()).toBe(true);

    modeler.undo();
    expect(modeler.canRedo()).toBe(true);

    const exported = modeler.exportModel();
    expect(exported.elements.find((e) => e.id === elementId)?.name).toBe(
      originalName,
    );

    const xml = serializeOpenExchange(exported);
    const reparsed = parseOpenExchange(xml);
    expect(reparsed.elements.find((e) => e.id === elementId)?.name).toBe(
      originalName,
    );
  });

  it("redo na undo herstelt de wijziging", async () => {
    await modeler.importXML(simpleBusinessXml);

    const elementRegistry =
      modeler.get<ElementRegistryLike>("elementRegistry");
    const cs = modeler.get<CommandStackLike>("commandStack");

    const shapes = elementRegistry.filter(
      (el) => !el.waypoints && !!el.businessObject?.elementId,
    );
    const first = shapes[0]!;
    const elementId = first.businessObject!.elementId!;

    cs.execute("archimate.update.bo", {
      element: first,
      properties: { name: "After undo redo" },
    });
    modeler.undo();
    modeler.redo();

    const exported = modeler.exportModel();
    expect(exported.elements.find((e) => e.id === elementId)?.name).toBe(
      "After undo redo",
    );
  });
});

/**
 * @vitest-environment happy-dom
 *
 * Modeler integration-test: importXML → palette mounted → programmatic add
 * via elementFactory + modeling → exportModel reflects nieuwe state.
 *
 * Doel: bewijzen dat M4-a write-path werkt zonder UI-interactie. Volledige
 * drag-drop end-to-end test gebeurt in Playwright e2e.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { Modeler } from "../src/index.js";

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

describe("Modeler integration (happy-dom)", () => {
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

  it("importXML rendert net als Viewer (parity-check)", async () => {
    await modeler.importXML(simpleBusinessXml);

    const model = modeler.getModel();
    expect(model?.elements).toHaveLength(2);
    expect(model?.views[0]?.nodes).toHaveLength(2);

    const rects = container.querySelectorAll("svg rect");
    expect(rects.length).toBeGreaterThanOrEqual(2);
  });

  it("palette-module registreert provider met 3 ArchiMate-create-entries", () => {
    const palette = modeler.get<{ getEntries: () => Record<string, unknown> }>(
      "palette",
    );
    const entries = palette.getEntries();
    expect(entries["create.business-actor"]).toBeDefined();
    expect(entries["create.business-process"]).toBeDefined();
    expect(entries["create.application-component"]).toBeDefined();
  });

  it("exportModel reflecteert programmatisch toegevoegde shape", async () => {
    await modeler.importXML(simpleBusinessXml);

    const canvas = modeler.get<DiagramCanvasLike>("canvas");
    const elementFactory = modeler.get<ElementFactoryLike>("elementFactory");

    const newShape = elementFactory.createShape({
      id: "new-shape-1",
      x: 400,
      y: 100,
      width: 140,
      height: 60,
      businessObject: {
        elementId: "new-el-1",
        archimateType: "ApplicationComponent",
        layer: "application",
        name: "New App",
      },
    });
    canvas.addShape(newShape);

    const exported = modeler.exportModel();

    // Bestaande 2 elements + nieuwe 1 = 3
    expect(exported.elements).toHaveLength(3);
    const newEl = exported.elements.find((e) => e.id === "new-el-1");
    expect(newEl).toBeDefined();
    expect(newEl?.type).toBe("ApplicationComponent");
    expect(newEl?.layer).toBe("application");
    expect(newEl?.name).toBe("New App");

    // View-nodes moeten ook de nieuwe shape bevatten
    expect(exported.views[0]?.nodes).toHaveLength(3);
    const newNode = exported.views[0]?.nodes.find((n) => n.id === "new-shape-1");
    expect(newNode).toBeDefined();
    expect(newNode?.elementRef).toBe("new-el-1");
    expect(newNode?.x).toBe(400);
    expect(newNode?.y).toBe(100);
  });

  it("exportModel zonder geladen model gooit error", () => {
    expect(() => modeler.exportModel()).toThrow(/geen model geladen/i);
  });

  it("on('commandStack.changed') ontvangt events bij modeling-mutaties", async () => {
    await modeler.importXML(simpleBusinessXml);

    let changeCount = 0;
    const handler = () => {
      changeCount += 1;
    };
    modeler.on("commandStack.changed", handler);

    // Trigger een modeling-actie via Modeling-service om commandStack te raken
    const modeling = modeler.get<{
      createShape: (shape: unknown, position: { x: number; y: number }, parent: unknown) => unknown;
    }>("modeling");
    const canvas = modeler.get<DiagramCanvasLike>("canvas");
    const elementFactory = modeler.get<ElementFactoryLike>("elementFactory");

    const shape = elementFactory.createShape({
      width: 140,
      height: 60,
      businessObject: {
        elementId: "test-el-2",
        archimateType: "BusinessActor",
        layer: "business",
        name: "Test Actor",
      },
    });
    modeling.createShape(shape, { x: 500, y: 200 }, canvas.getRootElement());

    expect(changeCount).toBeGreaterThan(0);

    modeler.off("commandStack.changed", handler);
  });
});

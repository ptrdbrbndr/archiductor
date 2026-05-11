/**
 * @vitest-environment happy-dom
 *
 * uml-js viewer integration tests:
 *  1. Parser: 2 classes + 1 inheritance → correcte UmlClass objecten
 *  2. Viewer.importXml(): voltooit zonder error, SVG-shapes op canvas
 *  3. Interface + abstracte class worden correct geparsed
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { parseXmi } from "../src/parser/XmiParser.js";
import { Viewer } from "../src/Viewer.js";

// ─── SVG-patches voor happy-dom ───────────────────────────────────────────────

beforeAll(() => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const w = globalThis as unknown as { SVGTransformList?: any };
  if (
    typeof w.SVGTransformList === "function" &&
    typeof w.SVGTransformList.prototype.consolidate !== "function"
  ) {
    w.SVGTransformList.prototype.consolidate = function (): null {
      return null;
    };
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
});

// ─── XMI fixtures ─────────────────────────────────────────────────────────────

const TWO_CLASSES_XMI = `<?xml version="1.0" encoding="UTF-8"?>
<uml:Model xmi:version="20131001"
  xmlns:xmi="http://www.omg.org/spec/XMI/20131001"
  xmlns:uml="http://www.eclipse.org/uml2/5.0.0/UML"
  xmi:id="model-1"
  name="TestModel">
  <packagedElement xmi:type="uml:Class" xmi:id="cls-animal" name="Animal" isAbstract="true">
    <ownedAttribute xmi:id="attr-name" name="name" visibility="protected">
      <type xmi:type="uml:PrimitiveType" href="pathmap://UML_LIBRARIES/UMLPrimitiveTypes.library.uml#String"/>
    </ownedAttribute>
    <ownedOperation xmi:id="op-speak" name="speak" visibility="public"/>
  </packagedElement>
  <packagedElement xmi:type="uml:Class" xmi:id="cls-dog" name="Dog">
    <generalization xmi:id="gen-1" general="cls-animal"/>
    <ownedOperation xmi:id="op-bark" name="bark" visibility="public"/>
  </packagedElement>
</uml:Model>`;

const INTERFACE_XMI = `<?xml version="1.0" encoding="UTF-8"?>
<uml:Model xmi:version="20131001"
  xmlns:xmi="http://www.omg.org/spec/XMI/20131001"
  xmlns:uml="http://www.eclipse.org/uml2/5.0.0/UML"
  xmi:id="model-2"
  name="InterfaceModel">
  <packagedElement xmi:type="uml:Interface" xmi:id="iface-1" name="Serializable">
    <ownedOperation xmi:id="op-serialize" name="serialize" visibility="public"/>
  </packagedElement>
  <packagedElement xmi:type="uml:Class" xmi:id="cls-impl" name="DataObject">
    <interfaceRealization xmi:id="real-1" contract="iface-1"/>
  </packagedElement>
</uml:Model>`;

const ASSOCIATION_XMI = `<?xml version="1.0" encoding="UTF-8"?>
<uml:Model xmi:version="20131001"
  xmlns:xmi="http://www.omg.org/spec/XMI/20131001"
  xmlns:uml="http://www.eclipse.org/uml2/5.0.0/UML"
  xmi:id="model-3"
  name="AssocModel">
  <packagedElement xmi:type="uml:Class" xmi:id="cls-order" name="Order">
    <ownedAttribute xmi:id="attr-id" name="id" visibility="private"/>
    <ownedAttribute xmi:id="attr-total" name="total" visibility="private"/>
    <ownedOperation xmi:id="op-confirm" name="confirm" visibility="public">
      <ownedParameter xmi:id="param-ret" direction="return"/>
    </ownedOperation>
  </packagedElement>
  <packagedElement xmi:type="uml:Class" xmi:id="cls-customer" name="Customer">
    <ownedAttribute xmi:id="attr-cname" name="name" visibility="public"/>
  </packagedElement>
  <packagedElement xmi:type="uml:Association" xmi:id="assoc-1" name="places">
    <ownedEnd xmi:id="end-1" type="cls-customer"/>
    <ownedEnd xmi:id="end-2" type="cls-order"/>
  </packagedElement>
</uml:Model>`;

// ─── Parser tests ─────────────────────────────────────────────────────────────

describe("XmiParser", () => {
  it("parset 2 classes + 1 inheritance relatie correct", () => {
    const model = parseXmi(TWO_CLASSES_XMI);

    expect(model.name).toBe("TestModel");
    expect(model.classes).toHaveLength(2);

    const animal = model.classes.find((c) => c.id === "cls-animal");
    expect(animal).toBeDefined();
    expect(animal?.name).toBe("Animal");
    expect(animal?.isAbstract).toBe(true);
    expect(animal?.isInterface).toBe(false);
    expect(animal?.attributes).toHaveLength(1);
    expect(animal?.attributes[0]?.name).toBe("name");
    expect(animal?.attributes[0]?.visibility).toBe("protected");
    expect(animal?.operations).toHaveLength(1);
    expect(animal?.operations[0]?.name).toBe("speak");

    const dog = model.classes.find((c) => c.id === "cls-dog");
    expect(dog).toBeDefined();
    expect(dog?.name).toBe("Dog");
    expect(dog?.isAbstract).toBe(false);

    expect(model.relations).toHaveLength(1);
    const gen = model.relations[0];
    expect(gen?.type).toBe("generalization");
    expect(gen?.sourceId).toBe("cls-dog");
    expect(gen?.targetId).toBe("cls-animal");
  });

  it("parset interface en realization relatie", () => {
    const model = parseXmi(INTERFACE_XMI);

    expect(model.classes).toHaveLength(2);

    const iface = model.classes.find((c) => c.id === "iface-1");
    expect(iface?.isInterface).toBe(true);
    expect(iface?.name).toBe("Serializable");

    const impl = model.classes.find((c) => c.id === "cls-impl");
    expect(impl?.name).toBe("DataObject");

    expect(model.relations).toHaveLength(1);
    const real = model.relations[0];
    expect(real?.type).toBe("realization");
    expect(real?.sourceId).toBe("cls-impl");
    expect(real?.targetId).toBe("iface-1");
  });

  it("parset association relatie", () => {
    const model = parseXmi(ASSOCIATION_XMI);

    expect(model.classes).toHaveLength(2);

    const order = model.classes.find((c) => c.id === "cls-order");
    expect(order?.attributes).toHaveLength(2);
    expect(order?.operations).toHaveLength(1);
    expect(order?.operations[0]?.name).toBe("confirm");

    const assoc = model.relations.find((r) => r.type === "association");
    expect(assoc).toBeDefined();
    expect(assoc?.name).toBe("places");
  });

  it("visibiliteitssymbolen worden correct gemapt", () => {
    const model = parseXmi(TWO_CLASSES_XMI);
    const animal = model.classes.find((c) => c.id === "cls-animal");
    expect(animal?.attributes[0]?.visibility).toBe("protected");
    expect(animal?.operations[0]?.visibility).toBe("public");
  });
});

// ─── Viewer integration tests ─────────────────────────────────────────────────

describe("Viewer integration (happy-dom)", () => {
  let container: HTMLDivElement;
  let viewer: Viewer;

  beforeEach(() => {
    container = document.createElement("div");
    container.style.width = "800px";
    container.style.height = "600px";
    document.body.appendChild(container);
    viewer = new Viewer({ container });
  });

  afterEach(() => {
    viewer.destroy();
    container.remove();
  });

  it("importXml voltooit zonder error op 2-classes XMI", async () => {
    await expect(viewer.importXml(TWO_CLASSES_XMI)).resolves.toBeUndefined();
  });

  it("importXml hydrateert canvas met SVG shapes", async () => {
    await viewer.importXml(TWO_CLASSES_XMI);

    const svg = container.querySelector("svg");
    expect(svg, "diagram-js moet een <svg> in de container zetten").not.toBeNull();
  });

  it("getModel() geeft het geladen model terug na importXml", async () => {
    await viewer.importXml(TWO_CLASSES_XMI);

    const model = viewer.getModel();
    expect(model).not.toBeNull();
    expect(model?.classes).toHaveLength(2);
    expect(model?.relations).toHaveLength(1);
  });

  it("importXml werkt ook op interface XMI", async () => {
    await expect(viewer.importXml(INTERFACE_XMI)).resolves.toBeUndefined();

    const model = viewer.getModel();
    expect(model?.classes).toHaveLength(2);
    expect(model?.classes.find((c) => c.isInterface)?.name).toBe("Serializable");
  });

  it("destroy() kan meerdere keren worden aangeroepen zonder error", async () => {
    await viewer.importXml(TWO_CLASSES_XMI);
    expect(() => viewer.destroy()).not.toThrow();
  });
});

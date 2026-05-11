/**
 * @vitest-environment happy-dom
 *
 * Tests voor UML component diagram:
 *  1. Parser: 2 components + 1 dependency relatie
 *  2. detectDiagramType: herkent component XMI
 *  3. Viewer.importXml: voltooit zonder error
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { parseComponentXmi } from "../src/parser/ComponentParser.js";
import { detectDiagramType } from "../src/Viewer.js";
import { Viewer } from "../src/Viewer.js";

// ─── XMI fixtures ─────────────────────────────────────────────────────────────

const COMPONENT_XMI = `<?xml version="1.0" encoding="UTF-8"?>
<uml:Model xmi:version="20131001"
  xmlns:xmi="http://www.omg.org/spec/XMI/20131001"
  xmlns:uml="http://www.eclipse.org/uml2/5.0.0/UML"
  xmi:id="model-comp"
  name="ComponentModel">
  <packagedElement xmi:type="uml:Component" xmi:id="comp-frontend" name="Frontend">
    <interfaceRealization xmi:id="real-1" contract="iface-api"/>
  </packagedElement>
  <packagedElement xmi:type="uml:Component" xmi:id="comp-backend" name="Backend"/>
  <packagedElement xmi:type="uml:Dependency" xmi:id="dep-1"
    client="comp-frontend" supplier="comp-backend"/>
</uml:Model>`;

const COMPONENT_WITH_IFACES_XMI = `<?xml version="1.0" encoding="UTF-8"?>
<uml:Model xmi:version="20131001"
  xmlns:xmi="http://www.omg.org/spec/XMI/20131001"
  xmlns:uml="http://www.eclipse.org/uml2/5.0.0/UML"
  xmi:id="model-comp2"
  name="ComponentModel2">
  <packagedElement xmi:type="uml:Component" xmi:id="comp-a" name="ServiceA">
    <interfaceRealization xmi:id="real-api" contract="IService"/>
    <usage xmi:id="usage-1" supplier="IDatabase"/>
  </packagedElement>
  <packagedElement xmi:type="uml:Component" xmi:id="comp-b" name="ServiceB"/>
</uml:Model>`;

// ─── Parser tests ─────────────────────────────────────────────────────────────

describe("ComponentParser", () => {
  it("parset 2 components correct", () => {
    const diagram = parseComponentXmi(COMPONENT_XMI);

    expect(diagram.type).toBe("component");
    expect(diagram.components).toHaveLength(2);

    const frontend = diagram.components.find((c) => c.id === "comp-frontend");
    expect(frontend?.name).toBe("Frontend");

    const backend = diagram.components.find((c) => c.id === "comp-backend");
    expect(backend?.name).toBe("Backend");
  });

  it("parset 1 dependency relatie correct", () => {
    const diagram = parseComponentXmi(COMPONENT_XMI);

    expect(diagram.relations).toHaveLength(1);
    const dep = diagram.relations[0];
    expect(dep?.type).toBe("dependency");
    expect(dep?.sourceId).toBe("comp-frontend");
    expect(dep?.targetId).toBe("comp-backend");
  });

  it("parset provided interfaces via interfaceRealization", () => {
    const diagram = parseComponentXmi(COMPONENT_WITH_IFACES_XMI);

    const serviceA = diagram.components.find((c) => c.id === "comp-a");
    expect(serviceA?.providedInterfaces).toContain("IService");
  });

  it("parset required interfaces via usage", () => {
    const diagram = parseComponentXmi(COMPONENT_WITH_IFACES_XMI);

    const serviceA = diagram.components.find((c) => c.id === "comp-a");
    expect(serviceA?.requiredInterfaces).toContain("IDatabase");
  });
});

// ─── detectDiagramType tests ──────────────────────────────────────────────────

describe("detectDiagramType — component", () => {
  it("herkent component XMI op basis van uml:Component", () => {
    expect(detectDiagramType(COMPONENT_XMI)).toBe("component");
  });
});

// ─── Viewer integration ───────────────────────────────────────────────────────

describe("Viewer — component diagram", () => {
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

  it("importXml met component XMI voltooit zonder error", async () => {
    await expect(viewer.importXml(COMPONENT_XMI)).resolves.toBeUndefined();
  });

  it("getDetectedType() geeft 'component' terug na importXml", async () => {
    await viewer.importXml(COMPONENT_XMI);
    expect(viewer.getDetectedType()).toBe("component");
  });
});

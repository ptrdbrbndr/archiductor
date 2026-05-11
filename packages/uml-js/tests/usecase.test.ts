/**
 * @vitest-environment happy-dom
 *
 * Tests voor UML use case diagram:
 *  1. Parser: 1 actor + 2 use cases + 1 include relatie
 *  2. detectDiagramType: herkent use case XMI
 *  3. Viewer.importXml: voltooit zonder error
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { parseUseCaseXmi } from "../src/parser/UseCaseParser.js";
import { detectDiagramType } from "../src/Viewer.js";
import { Viewer } from "../src/Viewer.js";

// ─── XMI fixtures ─────────────────────────────────────────────────────────────

const USECASE_XMI = `<?xml version="1.0" encoding="UTF-8"?>
<uml:Model xmi:version="20131001"
  xmlns:xmi="http://www.omg.org/spec/XMI/20131001"
  xmlns:uml="http://www.eclipse.org/uml2/5.0.0/UML"
  xmi:id="model-uc"
  name="Bestelsysteem">
  <packagedElement xmi:type="uml:Actor" xmi:id="actor-klant" name="Klant"/>
  <packagedElement xmi:type="uml:UseCase" xmi:id="uc-bestellen" name="Bestelling plaatsen">
    <include xmi:id="inc-1" addition="uc-betalen"/>
  </packagedElement>
  <packagedElement xmi:type="uml:UseCase" xmi:id="uc-betalen" name="Betaling uitvoeren"/>
  <packagedElement xmi:type="uml:Association" xmi:id="assoc-1">
    <ownedEnd xmi:id="end-a1" type="actor-klant"/>
    <ownedEnd xmi:id="end-a2" type="uc-bestellen"/>
  </packagedElement>
</uml:Model>`;

// ─── Parser tests ─────────────────────────────────────────────────────────────

describe("UseCaseParser", () => {
  it("parset 1 actor correct", () => {
    const diagram = parseUseCaseXmi(USECASE_XMI);

    expect(diagram.type).toBe("usecase");
    expect(diagram.actors).toHaveLength(1);

    const klant = diagram.actors[0];
    expect(klant?.id).toBe("actor-klant");
    expect(klant?.name).toBe("Klant");
  });

  it("parset 2 use cases correct", () => {
    const diagram = parseUseCaseXmi(USECASE_XMI);

    expect(diagram.useCases).toHaveLength(2);

    const bestellen = diagram.useCases.find((u) => u.id === "uc-bestellen");
    expect(bestellen?.name).toBe("Bestelling plaatsen");

    const betalen = diagram.useCases.find((u) => u.id === "uc-betalen");
    expect(betalen?.name).toBe("Betaling uitvoeren");
  });

  it("parset include relatie correct", () => {
    const diagram = parseUseCaseXmi(USECASE_XMI);

    const include = diagram.relations.find((r) => r.type === "include");
    expect(include).toBeDefined();
    expect(include?.sourceId).toBe("uc-bestellen");
    expect(include?.targetId).toBe("uc-betalen");
  });

  it("parset association relatie tussen actor en use case", () => {
    const diagram = parseUseCaseXmi(USECASE_XMI);

    const assoc = diagram.relations.find((r) => r.type === "association");
    expect(assoc).toBeDefined();
    expect(assoc?.sourceId).toBe("actor-klant");
    expect(assoc?.targetId).toBe("uc-bestellen");
  });

  it("systemBoundary naam is gevuld vanuit model naam", () => {
    const diagram = parseUseCaseXmi(USECASE_XMI);
    expect(diagram.systemBoundary).toBe("Bestelsysteem");
  });
});

// ─── detectDiagramType tests ──────────────────────────────────────────────────

describe("detectDiagramType — usecase", () => {
  it("herkent use case XMI op basis van uml:Actor", () => {
    expect(detectDiagramType(USECASE_XMI)).toBe("usecase");
  });

  it("herkent use case XMI op basis van uml:UseCase (zonder Actor)", () => {
    const onlyUcXmi = USECASE_XMI.replace('xmi:type="uml:Actor"', 'xmi:type="uml:DataType"');
    expect(detectDiagramType(onlyUcXmi)).toBe("usecase");
  });
});

// ─── Viewer integration ───────────────────────────────────────────────────────

describe("Viewer — use case diagram", () => {
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

  it("importXml met use case XMI voltooit zonder error", async () => {
    await expect(viewer.importXml(USECASE_XMI)).resolves.toBeUndefined();
  });

  it("getDetectedType() geeft 'usecase' terug na importXml", async () => {
    await viewer.importXml(USECASE_XMI);
    expect(viewer.getDetectedType()).toBe("usecase");
  });
});

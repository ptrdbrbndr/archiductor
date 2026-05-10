/**
 * M1-week-1: OEF 4.0 parser + serializer tests.
 *
 * Tests:
 *  - Parse fixture `simple-business.xml` naar correcte ArchiModel
 *  - Layer-detectie op element-types (Business* → business, Application* → application, ...)
 *  - Relationship-type-mapping uit xsi:type
 *  - View-nodes + bendpoints parsen
 *  - Round-trip: parse → serialize → parse → deep equal
 *  - Onbekende element-types vallen terug op layer=business
 *  - 3.x namespace levert version=archimate-3.2
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, it, expect } from "vitest";

import {
  parseOpenExchange,
  serializeOpenExchange,
} from "../src/parse/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const simpleBusinessXml = readFileSync(
  resolve(__dirname, "fixtures/simple-business.xml"),
  "utf-8",
);

describe("parseOpenExchange — OEF 4.0 basis", () => {
  it("herkent de 4.0 namespace en zet version", () => {
    const model = parseOpenExchange(simpleBusinessXml);
    expect(model.version).toBe("archimate-4.0");
  });

  it("leest model-naam en documentation", () => {
    const model = parseOpenExchange(simpleBusinessXml);
    expect(model.name).toBe("Eenvoudig Business-voorbeeld");
    expect(model.documentation).toBe(
      "Demo-model voor archimate-js parser-tests.",
    );
  });

  it("parseert beide elementen met correct type + layer", () => {
    const model = parseOpenExchange(simpleBusinessXml);
    expect(model.elements).toHaveLength(2);
    const proces = model.elements.find((e) => e.id === "elem-1");
    expect(proces).toMatchObject({
      id: "elem-1",
      type: "BusinessProcess",
      layer: "business",
      name: "Order verwerken",
    });
    expect(proces?.documentation).toBe("Verwerkt inkomende orders.");

    const actor = model.elements.find((e) => e.id === "elem-2");
    expect(actor).toMatchObject({
      id: "elem-2",
      type: "BusinessActor",
      layer: "business",
      name: "Verkoper",
    });
  });

  it("parseert relationship met xsi:type Assignment", () => {
    const model = parseOpenExchange(simpleBusinessXml);
    expect(model.relationships).toHaveLength(1);
    expect(model.relationships[0]).toMatchObject({
      id: "rel-1",
      type: "Assignment",
      source: "elem-1",
      target: "elem-2",
    });
  });

  it("parseert view met 2 nodes + 1 connection + bendpoint", () => {
    const model = parseOpenExchange(simpleBusinessXml);
    expect(model.views).toHaveLength(1);
    const view = model.views[0];
    expect(view?.id).toBe("view-1");
    expect(view?.name).toBe("Hoofdview");
    expect(view?.nodes).toHaveLength(2);

    const node1 = view?.nodes.find((n) => n.id === "node-1");
    expect(node1).toMatchObject({
      elementRef: "elem-1",
      x: 80,
      y: 120,
      width: 160,
      height: 70,
    });

    expect(view?.connections).toHaveLength(1);
    expect(view?.connections[0]).toMatchObject({
      id: "conn-1",
      relationshipRef: "rel-1",
      sourceNodeRef: "node-1",
      targetNodeRef: "node-2",
    });
    expect(view?.connections[0]?.bendpoints).toEqual([{ x: 280, y: 155 }]);
  });
});

describe("parseOpenExchange — randgevallen", () => {
  it("valt terug op layer=business voor onbekend element-type", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://www.opengroup.org/xsd/archimate/4.0/"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       identifier="id-x">
  <name xml:lang="nl">Test</name>
  <elements>
    <element identifier="e-1" xsi:type="WizzleWozzle"><name xml:lang="nl">Onbekend</name></element>
  </elements>
</model>`;
    const model = parseOpenExchange(xml);
    expect(model.elements[0]?.layer).toBe("business");
    expect(model.elements[0]?.type).toBe("WizzleWozzle");
  });

  it("herkent 3.0 namespace als archimate-3.2", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://www.opengroup.org/xsd/archimate/3.0/" identifier="id-x">
  <name xml:lang="nl">Test</name>
</model>`;
    expect(parseOpenExchange(xml).version).toBe("archimate-3.2");
  });

  it("mapt elke ArchiMate-laag op het juiste laag-veld", () => {
    const cases: { type: string; layer: string }[] = [
      { type: "BusinessProcess", layer: "business" },
      { type: "ApplicationComponent", layer: "application" },
      { type: "Node", layer: "technology" },
      { type: "Goal", layer: "motivation" },
      { type: "Capability", layer: "strategy" },
      { type: "Facility", layer: "physical" },
      { type: "WorkPackage", layer: "implementation" },
    ];
    for (const { type, layer } of cases) {
      const xml = `<?xml version="1.0"?>
<model xmlns="http://www.opengroup.org/xsd/archimate/4.0/"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" identifier="id-x">
  <name xml:lang="nl">Test</name>
  <elements>
    <element identifier="e-1" xsi:type="${type}"><name xml:lang="nl">X</name></element>
  </elements>
</model>`;
      expect(parseOpenExchange(xml).elements[0]?.layer).toBe(layer);
    }
  });

  it("valt terug op layer=business voor onbekend relationship-type", () => {
    const xml = `<?xml version="1.0"?>
<model xmlns="http://www.opengroup.org/xsd/archimate/4.0/"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" identifier="id-x">
  <name xml:lang="nl">T</name>
  <relationships>
    <relationship identifier="r-1" source="a" target="b" xsi:type="UnknownRel"/>
  </relationships>
</model>`;
    expect(parseOpenExchange(xml).relationships[0]?.type).toBe("Association");
  });
});

describe("round-trip parse → serialize → parse", () => {
  it("behoudt structurele integriteit voor simple-business fixture", () => {
    const first = parseOpenExchange(simpleBusinessXml);
    const roundTripped = parseOpenExchange(serializeOpenExchange(first));

    expect(roundTripped.version).toBe(first.version);
    expect(roundTripped.elements).toEqual(first.elements);
    expect(roundTripped.relationships).toEqual(first.relationships);
    expect(roundTripped.views).toEqual(first.views);
  });

  it("serialize produceert geldig XML met OEF 4.0 namespace", () => {
    const model = parseOpenExchange(simpleBusinessXml);
    const xml = serializeOpenExchange(model);
    expect(xml).toContain('xmlns="http://www.opengroup.org/xsd/archimate/4.0/"');
    expect(xml).toContain('xsi:type="BusinessProcess"');
    expect(xml).toContain('xsi:type="Assignment"');
    expect(xml).toContain('xsi:type="Element"');
    expect(xml).toContain('xsi:type="Relationship"');
    expect(xml).toContain("<bendpoint");
  });
});

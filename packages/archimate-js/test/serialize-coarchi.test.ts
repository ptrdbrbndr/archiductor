/**
 * @vitest-environment node
 *
 * CoArchi serializer + round-trip: parseCoArchi(serializeCoArchi(m)) ≈ m.
 * Bewijst dat M5-a (read) ↔ M6-a (write) symmetrisch zijn voor de
 * elementen die we ondersteunen.
 */

import { describe, it, expect } from "vitest";

import {
  parseCoArchi,
  serializeCoArchi,
  type ArchiModel,
} from "../src/index.js";

const SAMPLE: ArchiModel = {
  version: "archimate-4.0",
  name: "Round-trip sample",
  elements: [
    {
      id: "actor-1",
      name: "Klant",
      type: "BusinessActor",
      layer: "business",
      documentation: "De klant die een bestelling plaatst.",
    },
    {
      id: "process-1",
      name: "Order verwerken",
      type: "BusinessProcess",
      layer: "business",
      properties: { owner: "operations" },
    },
    {
      id: "component-1",
      name: "Order Mgmt",
      type: "ApplicationComponent",
      layer: "application",
    },
  ],
  relationships: [
    {
      id: "rel-1",
      type: "Assignment",
      source: "actor-1",
      target: "process-1",
    },
    {
      id: "rel-2",
      type: "Flow",
      source: "process-1",
      target: "component-1",
      name: "data-flow",
    },
  ],
  views: [
    {
      id: "view-1",
      name: "Overzicht",
      nodes: [
        {
          id: "node-1",
          elementRef: "actor-1",
          x: 10,
          y: 10,
          width: 140,
          height: 60,
        },
        {
          id: "node-2",
          elementRef: "process-1",
          x: 200,
          y: 10,
          width: 140,
          height: 60,
        },
        {
          id: "node-3",
          elementRef: "component-1",
          x: 400,
          y: 10,
          width: 140,
          height: 60,
        },
      ],
      connections: [
        {
          id: "conn-1",
          relationshipRef: "rel-1",
          sourceNodeRef: "node-1",
          targetNodeRef: "node-2",
          bendpoints: [],
        },
        {
          id: "conn-2",
          relationshipRef: "rel-2",
          sourceNodeRef: "node-2",
          targetNodeRef: "node-3",
          bendpoints: [],
        },
      ],
    },
  ],
};

describe("serializeCoArchi + round-trip", () => {
  it("produceert one file per element/relation/view + model manifest", () => {
    const files = serializeCoArchi(SAMPLE);
    expect(files["model.xml"]).toBeDefined();
    expect(files["business/actor-1.xml"]).toBeDefined();
    expect(files["business/process-1.xml"]).toBeDefined();
    expect(files["application/component-1.xml"]).toBeDefined();
    expect(files["relations/rel-1.xml"]).toBeDefined();
    expect(files["relations/rel-2.xml"]).toBeDefined();
    expect(files["diagrams/view-1.xml"]).toBeDefined();

    // Element-content bevat archimate:type tag + name
    expect(files["business/actor-1.xml"]).toContain("archimate:BusinessActor");
    expect(files["business/actor-1.xml"]).toContain('name="Klant"');
    expect(files["business/actor-1.xml"]).toContain("<documentation>");

    // Relationship-tag bevat Relationship-suffix
    expect(files["relations/rel-1.xml"]).toContain(
      "archimate:AssignmentRelationship",
    );
    expect(files["relations/rel-1.xml"]).toContain('source="actor-1"');
    expect(files["relations/rel-1.xml"]).toContain('target="process-1"');

    // View bevat child + sourceConnection
    expect(files["diagrams/view-1.xml"]).toContain("<child");
    expect(files["diagrams/view-1.xml"]).toContain("<sourceConnection");
    expect(files["diagrams/view-1.xml"]).toContain("rel-1");
  });

  it("custom properties worden gerenderd", () => {
    const files = serializeCoArchi(SAMPLE);
    expect(files["business/process-1.xml"]).toContain('key="owner"');
    expect(files["business/process-1.xml"]).toContain('value="operations"');
  });

  it("round-trip: serialize → parse → equals (sans synthetic fallbacks)", () => {
    const files = serializeCoArchi(SAMPLE);
    const reparsed = parseCoArchi(files);

    expect(reparsed.name).toBe(SAMPLE.name);
    expect(reparsed.elements).toHaveLength(SAMPLE.elements.length);
    expect(reparsed.relationships).toHaveLength(SAMPLE.relationships.length);
    expect(reparsed.views).toHaveLength(SAMPLE.views.length);

    for (const orig of SAMPLE.elements) {
      const back = reparsed.elements.find((e) => e.id === orig.id);
      expect(back, `element ${orig.id} terug in roundtrip`).toBeDefined();
      expect(back?.name).toBe(orig.name);
      expect(back?.type).toBe(orig.type);
      expect(back?.layer).toBe(orig.layer);
      if (orig.documentation) {
        expect(back?.documentation).toBe(orig.documentation);
      }
    }

    for (const orig of SAMPLE.relationships) {
      const back = reparsed.relationships.find((r) => r.id === orig.id);
      expect(back).toBeDefined();
      expect(back?.type).toBe(orig.type);
      expect(back?.source).toBe(orig.source);
      expect(back?.target).toBe(orig.target);
    }

    const view = reparsed.views[0]!;
    expect(view.nodes).toHaveLength(SAMPLE.views[0]!.nodes.length);
    expect(view.connections).toHaveLength(
      SAMPLE.views[0]!.connections.length,
    );
  });

  it("XML-escape voor onveilige karakters in naam/documentation", () => {
    const model: ArchiModel = {
      version: "archimate-4.0",
      name: 'Quotes "&" angles <>',
      elements: [
        {
          id: "el-1",
          name: 'Naam met "quote" & <html>',
          type: "BusinessProcess",
          layer: "business",
          documentation: "Doc met <special> & 'apos' chars",
        },
      ],
      relationships: [],
      views: [],
    };
    const files = serializeCoArchi(model);
    const elFile = files["business/el-1.xml"]!;
    // Geen raw `<html>` of `&` in attribute-context
    expect(elFile).toContain("&quot;");
    expect(elFile).toContain("&amp;");
    expect(elFile).toContain("&lt;html&gt;");
    // Documentation: text-context, &apos hoeft niet
    expect(elFile).toContain("&lt;special&gt;");
  });

  it("safe filename voor ids met onveilige chars", () => {
    const model: ArchiModel = {
      version: "archimate-4.0",
      name: "Slash test",
      elements: [
        {
          id: "id/with/slash",
          name: "Slash",
          type: "BusinessProcess",
          layer: "business",
        },
      ],
      relationships: [],
      views: [],
    };
    const files = serializeCoArchi(model);
    expect(files["business/id_with_slash.xml"]).toBeDefined();
  });
});

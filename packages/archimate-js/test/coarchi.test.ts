/**
 * @vitest-environment node
 *
 * CoArchi parser-test — feed een hand-gemaakte mini-CoArchi-file-map en
 * verifieer dat het uitkomst-ArchiModel overeenkomt met onze verwachting.
 *
 * Volledige file-layout (sub-set van wat Archi-coarchi 0.10+ produceert):
 *
 *   model.xml                              — manifest
 *   business/element-actor.xml             — BusinessActor
 *   business/element-process.xml           — BusinessProcess
 *   application/element-component.xml      — ApplicationComponent
 *   relations/rel-assignment.xml           — Assignment(actor → process)
 *   relations/rel-flow.xml                 — Flow(process → component)
 *   diagrams/view-overview.xml             — view met 3 nodes + 2 connections
 *   folder.xml                             — service-file, moet worden genegeerd
 */

import { describe, it, expect } from "vitest";

import { parseCoArchi } from "../src/index.js";

const MODEL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<archimate:model xmlns:archimate="http://www.archimatetool.com/archimate"
                 name="Mini CoArchi Sample"
                 id="model-1"/>`;

const ACTOR_XML = `<?xml version="1.0" encoding="UTF-8"?>
<archimate:BusinessActor xmlns:archimate="http://www.archimatetool.com/archimate"
                         id="actor-1" name="Klant">
  <documentation>De klant die een bestelling plaatst.</documentation>
</archimate:BusinessActor>`;

const PROCESS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<archimate:BusinessProcess xmlns:archimate="http://www.archimatetool.com/archimate"
                           id="process-1" name="Order verwerken"/>`;

const COMPONENT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<archimate:ApplicationComponent xmlns:archimate="http://www.archimatetool.com/archimate"
                                id="component-1" name="Order Mgmt"/>`;

const REL_ASSIGN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<archimate:AssignmentRelationship xmlns:archimate="http://www.archimatetool.com/archimate"
                                  id="rel-1" source="actor-1" target="process-1"/>`;

const REL_FLOW_XML = `<?xml version="1.0" encoding="UTF-8"?>
<archimate:FlowRelationship xmlns:archimate="http://www.archimatetool.com/archimate"
                            id="rel-2" source="process-1" target="component-1"
                            name="data-flow"/>`;

const VIEW_XML = `<?xml version="1.0" encoding="UTF-8"?>
<archimate:ArchimateDiagramModel xmlns:archimate="http://www.archimatetool.com/archimate"
                                 id="view-1" name="Overzicht">
  <child id="node-1" archimateElement="actor-1" x="10" y="10" width="140" height="60"/>
  <child id="node-2" archimateElement="process-1" x="200" y="10" width="140" height="60">
    <sourceConnection id="conn-2" source="node-2" target="node-3"
                      archimateRelationship="rel-2"/>
  </child>
  <child id="node-3" archimateElement="component-1" x="400" y="10" width="140" height="60"/>
  <sourceConnection id="conn-1" source="node-1" target="node-2"
                    archimateRelationship="rel-1"/>
</archimate:ArchimateDiagramModel>`;

const FOLDER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<archimate:folder xmlns:archimate="http://www.archimatetool.com/archimate"
                  name="Business" type="business"/>`;

describe("parseCoArchi — mini sample", () => {
  it("aggregates files into one ArchiModel", () => {
    const files = {
      "model.xml": MODEL_XML,
      "business/folder.xml": FOLDER_XML,
      "business/element-actor.xml": ACTOR_XML,
      "business/element-process.xml": PROCESS_XML,
      "application/element-component.xml": COMPONENT_XML,
      "relations/rel-assignment.xml": REL_ASSIGN_XML,
      "relations/rel-flow.xml": REL_FLOW_XML,
      "diagrams/view-overview.xml": VIEW_XML,
    };

    const model = parseCoArchi(files);

    expect(model.name).toBe("Mini CoArchi Sample");
    expect(model.elements).toHaveLength(3);

    const actor = model.elements.find((e) => e.id === "actor-1");
    expect(actor?.type).toBe("BusinessActor");
    expect(actor?.layer).toBe("business");
    expect(actor?.documentation).toBe("De klant die een bestelling plaatst.");

    const process = model.elements.find((e) => e.id === "process-1");
    expect(process?.type).toBe("BusinessProcess");
    expect(process?.layer).toBe("business");

    const component = model.elements.find((e) => e.id === "component-1");
    expect(component?.layer).toBe("application");

    expect(model.relationships).toHaveLength(2);
    const assign = model.relationships.find((r) => r.id === "rel-1");
    expect(assign?.type).toBe("Assignment");
    expect(assign?.source).toBe("actor-1");
    expect(assign?.target).toBe("process-1");

    const flow = model.relationships.find((r) => r.id === "rel-2");
    expect(flow?.type).toBe("Flow");
    expect(flow?.name).toBe("data-flow");

    expect(model.views).toHaveLength(1);
    const view = model.views[0]!;
    expect(view.id).toBe("view-1");
    expect(view.name).toBe("Overzicht");
    expect(view.nodes).toHaveLength(3);
    expect(view.connections).toHaveLength(2);
    expect(view.nodes.find((n) => n.id === "node-1")?.elementRef).toBe("actor-1");
    expect(view.connections.find((c) => c.id === "conn-1")?.relationshipRef).toBe(
      "rel-1",
    );
    expect(view.connections.find((c) => c.id === "conn-2")?.relationshipRef).toBe(
      "rel-2",
    );
  });

  it("genereert synthetic view als er geen diagrams zijn", () => {
    const files = {
      "model.xml": MODEL_XML,
      "business/element-1.xml": ACTOR_XML,
      "business/element-2.xml": PROCESS_XML,
    };
    const model = parseCoArchi(files);
    expect(model.views).toHaveLength(1);
    expect(model.views[0]?.nodes).toHaveLength(2);
    // Auto-layout in grid: eerste node op (0,0), tweede op (170,0) — W=140, GAP=30
    const node1 = model.views[0]?.nodes.find(
      (n) => n.elementRef === "actor-1",
    );
    expect(node1?.x).toBe(0);
    expect(node1?.y).toBe(0);
  });

  it("gooit error bij lege / niet-CoArchi tree", () => {
    expect(() => parseCoArchi({})).toThrow(/CoArchi/);
    expect(() =>
      parseCoArchi({ "readme.md": "# Not a model" }),
    ).toThrow(/CoArchi/);
  });

  it("negeert files boven maxFileSize", () => {
    const huge = "x".repeat(2 * 1024 * 1024);
    const files = {
      "model.xml": MODEL_XML,
      "business/element-actor.xml": ACTOR_XML,
      "business/giant.xml": huge,
    };
    const model = parseCoArchi(files, { maxFileSize: 1024 * 1024 });
    expect(model.elements).toHaveLength(1);
    expect(model.elements[0]?.id).toBe("actor-1");
  });

  it("negeert folder.xml service-files", () => {
    const files = {
      "model.xml": MODEL_XML,
      "business/folder.xml": FOLDER_XML,
      "business/element-1.xml": ACTOR_XML,
    };
    const model = parseCoArchi(files);
    expect(model.elements).toHaveLength(1);
  });
});

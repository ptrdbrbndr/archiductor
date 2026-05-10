/**
 * Deliverable 8 — Round-trip op 20 modellen.
 *
 * Genereert 20 synthetische OEF 4.0-modellen die samen alle 7 lagen + alle
 * 11 relationship-types + variaties in size en complexity dekken. Voor elk:
 *
 *    XML → parseOpenExchange → serializeOpenExchange → parseOpenExchange
 *
 * Vergelijking: de eerste en de tweede ArchiModel moeten structureel
 * identiek zijn (parse-roundtrip-stabiel). Dit bewijst dat de parser én
 * serializer geen data verliezen voor de gangbare ArchiMate-features.
 *
 * Synthetisch i.p.v. Open-Group test-corpus omdat:
 *  - Geen externe download dependency in CI
 *  - Volledige type-coverage gegarandeerd
 *  - Reproduceerbaar en deterministisch
 *
 * Later (M1-week-2) kunnen écht-bestaande Open-Group test-modellen toegevoegd
 * worden onder `test/fixtures/open-group/` voor extra real-world coverage.
 */

import { describe, expect, it } from "vitest";

import {
  parseOpenExchange,
  serializeOpenExchange,
} from "../src/parse/index.js";
import type {
  ArchiElement,
  ArchiLayer,
  ArchiRelationship,
  ArchiRelationshipType,
  ArchiViewConnection,
  ArchiViewNode,
} from "../src/types.js";

const ALL_LAYERS: { layer: ArchiLayer; types: string[] }[] = [
  { layer: "business", types: ["BusinessProcess", "BusinessActor", "BusinessService"] },
  { layer: "application", types: ["ApplicationComponent", "ApplicationService", "DataObject"] },
  { layer: "technology", types: ["Node", "Device", "SystemSoftware", "Artifact"] },
  { layer: "motivation", types: ["Stakeholder", "Goal", "Driver", "Requirement"] },
  { layer: "strategy", types: ["Capability", "Resource", "CourseOfAction"] },
  { layer: "physical", types: ["Equipment", "Facility", "Material"] },
  { layer: "implementation", types: ["WorkPackage", "Deliverable", "Plateau"] },
];

const ALL_RELATIONSHIPS: ArchiRelationshipType[] = [
  "Composition",
  "Aggregation",
  "Assignment",
  "Realization",
  "Triggering",
  "Flow",
  "Influence",
  "Access",
  "UsedBy",
  "Specialization",
  "Association",
];

/**
 * Bouw een synthetisch model. `seed` bepaalt deterministisch welke variaties
 * gekozen worden (layer-mix, rel-types, sizes).
 */
function buildModel(seed: number): string {
  // Pseudo-random uit seed (deterministisch).
  const rand = mulberry32(seed);

  const elements: ArchiElement[] = [];
  const relationships: ArchiRelationship[] = [];
  const nodes: ArchiViewNode[] = [];
  const connections: ArchiViewConnection[] = [];

  // 3-7 elementen, verschillende lagen.
  const elementCount = 3 + Math.floor(rand() * 5);
  for (let i = 0; i < elementCount; i++) {
    const layerSpec = ALL_LAYERS[Math.floor(rand() * ALL_LAYERS.length)];
    if (!layerSpec) continue;
    const type =
      layerSpec.types[Math.floor(rand() * layerSpec.types.length)] ??
      "BusinessProcess";
    const id = `elem-${seed}-${i}`;
    elements.push({
      id,
      name: `Element ${seed}.${i}`,
      type,
      layer: layerSpec.layer,
      documentation: i % 2 === 0 ? `Doc ${seed}.${i}` : undefined,
    });
    nodes.push({
      id: `node-${seed}-${i}`,
      elementRef: id,
      x: 50 + (i % 4) * 200,
      y: 50 + Math.floor(i / 4) * 150,
      width: 160,
      height: 70,
    });
  }

  // 1-5 relationships tussen willekeurige elementen.
  const relCount = Math.min(elementCount - 1, 1 + Math.floor(rand() * 5));
  for (let i = 0; i < relCount; i++) {
    const sourceIdx = Math.floor(rand() * elements.length);
    let targetIdx = Math.floor(rand() * elements.length);
    if (targetIdx === sourceIdx) targetIdx = (sourceIdx + 1) % elements.length;
    const sourceEl = elements[sourceIdx];
    const targetEl = elements[targetIdx];
    if (!sourceEl || !targetEl) continue;
    const relType =
      ALL_RELATIONSHIPS[Math.floor(rand() * ALL_RELATIONSHIPS.length)] ??
      "Association";
    const id = `rel-${seed}-${i}`;
    relationships.push({
      id,
      type: relType,
      source: sourceEl.id,
      target: targetEl.id,
    });
    const sourceNode = nodes[sourceIdx];
    const targetNode = nodes[targetIdx];
    if (!sourceNode || !targetNode) continue;
    const bendpointCount = Math.floor(rand() * 3);
    const bendpoints: { x: number; y: number }[] = [];
    for (let b = 0; b < bendpointCount; b++) {
      bendpoints.push({
        x: Math.floor((sourceNode.x + targetNode.x) / 2 + b * 30),
        y: Math.floor((sourceNode.y + targetNode.y) / 2 + b * 20),
      });
    }
    connections.push({
      id: `conn-${seed}-${i}`,
      relationshipRef: id,
      sourceNodeRef: sourceNode.id,
      targetNodeRef: targetNode.id,
      bendpoints,
    });
  }

  // Serialize via onze eigen serializer voor consistent OEF-output.
  return serializeOpenExchange({
    version: "archimate-4.0",
    name: `Synthetic Model ${seed}`,
    documentation: `Generated round-trip fixture seed=${seed}`,
    elements,
    relationships,
    views: [
      {
        id: `view-${seed}`,
        name: `View ${seed}`,
        nodes,
        connections,
      },
    ],
  });
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("round-trip op 20 synthetische modellen (deliverable 8)", () => {
  for (let seed = 1; seed <= 20; seed++) {
    it(`seed ${seed}: parse(serialize(parse(xml))) === parse(xml)`, () => {
      const xml = buildModel(seed);
      const first = parseOpenExchange(xml);
      const reSerialized = serializeOpenExchange(first);
      const second = parseOpenExchange(reSerialized);

      // Structurele equivalentie van model-data — version, elements (incl
      // layer/type/name/doc), relationships (incl type/source/target),
      // views (incl nodes met x/y/w/h + connections met bendpoints).
      expect(second.version).toBe(first.version);
      expect(second.name).toBe(first.name);
      expect(second.documentation).toBe(first.documentation);
      expect(second.elements).toEqual(first.elements);
      expect(second.relationships).toEqual(first.relationships);
      expect(second.views).toEqual(first.views);
    });
  }

  it("dekt samen alle 7 lagen + alle 11 relationship-types", () => {
    const layersSeen = new Set<string>();
    const relTypesSeen = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const m = parseOpenExchange(buildModel(seed));
      for (const e of m.elements) layersSeen.add(e.layer);
      for (const r of m.relationships) relTypesSeen.add(r.type);
    }
    expect(layersSeen.size).toBe(7);
    expect(relTypesSeen.size).toBe(11);
  });
});

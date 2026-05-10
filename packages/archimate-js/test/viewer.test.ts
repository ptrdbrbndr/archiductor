/**
 * @vitest-environment happy-dom
 *
 * Viewer integration-test: importXML → renderModel → SVG-output.
 *
 * Bewijst dat de hele archimate-js flow werkt in een browser-achtige
 * omgeving (happy-dom = ~80% van een echte browser, snel, geen
 * server nodig).
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { Viewer } from "../src/index.js";

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

  it("importXML hydrateert canvas met shapes + connections uit fixture", async () => {
    await viewer.importXML(simpleBusinessXml);

    const model = viewer.getModel();
    expect(model?.elements).toHaveLength(2);
    expect(model?.views[0]?.nodes).toHaveLength(2);
    expect(model?.views[0]?.connections).toHaveLength(1);

    // diagram-js rendert SVG in de container. Verifieer dat shapes + paths
    // gegenereerd zijn.
    const svg = container.querySelector("svg");
    expect(svg, "diagram-js moet een <svg> in de container zetten").not.toBeNull();

    const rects = container.querySelectorAll("svg rect");
    expect(
      rects.length,
      "2 ArchiMate-shapes moeten resulteren in minimaal 2 <rect>s",
    ).toBeGreaterThanOrEqual(2);

    const paths = container.querySelectorAll("svg path");
    expect(
      paths.length,
      "Assignment-relatie genereert hoofdlijn + marker(s) als <path>",
    ).toBeGreaterThanOrEqual(1);

    const texts = container.querySelectorAll("svg text");
    const textContents = Array.from(texts).map((t) => t.textContent);
    expect(textContents).toContain("Order verwerken");
    expect(textContents).toContain("Verkoper");
  });

  it("rendert 4 elementen uit 4 verschillende lagen elk als eigen shape", async () => {
    // Inhoudelijke validatie van laag-kleuren via attribute-introspection
    // werkt niet in happy-dom (getAttribute geeft null op SVG-attrs); pixel-
    // perfecte validatie volgt in een Playwright e2e-test in een echte browser.
    // Hier verifiëren we de structurele invariant: 4 elementen → minimaal 4 rects.
    const multiLayerXml = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://www.opengroup.org/xsd/archimate/4.0/"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       identifier="id-multi">
  <name xml:lang="nl">Multi-layer test</name>
  <elements>
    <element identifier="e-1" xsi:type="BusinessProcess"><name xml:lang="nl">Biz</name></element>
    <element identifier="e-2" xsi:type="ApplicationComponent"><name xml:lang="nl">App</name></element>
    <element identifier="e-3" xsi:type="Node"><name xml:lang="nl">Tech</name></element>
    <element identifier="e-4" xsi:type="Goal"><name xml:lang="nl">Mot</name></element>
  </elements>
  <views>
    <diagrams>
      <view identifier="v-1" xsi:type="Diagram">
        <name xml:lang="nl">Multi</name>
        <node identifier="n-1" elementRef="e-1" x="10" y="10" w="100" h="50" xsi:type="Element"/>
        <node identifier="n-2" elementRef="e-2" x="120" y="10" w="100" h="50" xsi:type="Element"/>
        <node identifier="n-3" elementRef="e-3" x="230" y="10" w="100" h="50" xsi:type="Element"/>
        <node identifier="n-4" elementRef="e-4" x="340" y="10" w="100" h="50" xsi:type="Element"/>
      </view>
    </diagrams>
  </views>
</model>`;

    await viewer.importXML(multiLayerXml);

    const model = viewer.getModel();
    expect(model?.elements.map((e) => e.layer)).toEqual([
      "business",
      "application",
      "technology",
      "motivation",
    ]);

    const rects = container.querySelectorAll("svg rect");
    expect(rects.length).toBeGreaterThanOrEqual(4);

    const texts = Array.from(container.querySelectorAll("svg text")).map(
      (t) => t.textContent,
    );
    expect(texts).toContain("Biz");
    expect(texts).toContain("App");
    expect(texts).toContain("Tech");
    expect(texts).toContain("Mot");
  });

  it("rendert 2 connections (Triggering + Realization) met meerdere paths per connection (lijn + marker)", async () => {
    // Structurele validatie: 2 connections produceren minimaal 4 paths
    // (1 hoofdlijn + 1 target-marker per connection). Pixel-perfecte
    // marker-shape-validatie volgt in Playwright e2e in een echte browser.
    const multiRelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://www.opengroup.org/xsd/archimate/4.0/"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       identifier="id-rel">
  <name xml:lang="nl">Relation test</name>
  <elements>
    <element identifier="e-1" xsi:type="BusinessProcess"><name xml:lang="nl">A</name></element>
    <element identifier="e-2" xsi:type="BusinessProcess"><name xml:lang="nl">B</name></element>
  </elements>
  <relationships>
    <relationship identifier="r-1" source="e-1" target="e-2" xsi:type="Triggering"/>
    <relationship identifier="r-2" source="e-1" target="e-2" xsi:type="Realization"/>
  </relationships>
  <views>
    <diagrams>
      <view identifier="v-1" xsi:type="Diagram">
        <name xml:lang="nl">V</name>
        <node identifier="n-1" elementRef="e-1" x="0" y="0" w="100" h="50" xsi:type="Element"/>
        <node identifier="n-2" elementRef="e-2" x="200" y="0" w="100" h="50" xsi:type="Element"/>
        <connection identifier="c-1" relationshipRef="r-1" source="n-1" target="n-2" xsi:type="Relationship"/>
        <connection identifier="c-2" relationshipRef="r-2" source="n-1" target="n-2" xsi:type="Relationship"/>
      </view>
    </diagrams>
  </views>
</model>`;

    await viewer.importXML(multiRelXml);

    const model = viewer.getModel();
    expect(model?.relationships.map((r) => r.type)).toEqual([
      "Triggering",
      "Realization",
    ]);

    // Verwacht: 2 hoofdlijnen + 2 target-markers = ≥4 paths.
    const paths = container.querySelectorAll("svg path");
    expect(paths.length).toBeGreaterThanOrEqual(4);
  });
});

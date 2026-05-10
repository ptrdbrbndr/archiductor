/**
 * Public-API contract-test.
 *
 * Verifieert dat de exports van archimate-js werken bij minimaal-geldig input.
 * Volledige scenario-tests staan in andere test-files (parse.test.ts, etc.).
 */

import { describe, it, expect } from "vitest";

import { Viewer, parseOpenExchange, serializeOpenExchange } from "../src/index.js";

describe("archimate-js public API", () => {
  it("parseOpenExchange leest een minimaal OEF 4.0 model", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://www.opengroup.org/xsd/archimate/4.0/"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       identifier="id-test">
  <name xml:lang="nl">Test</name>
</model>`;
    const model = parseOpenExchange(xml);
    expect(model.version).toBe("archimate-4.0");
    expect(model.name).toBe("Test");
    expect(model.elements).toEqual([]);
    expect(model.relationships).toEqual([]);
    expect(model.views).toEqual([]);
  });

  it("serializeOpenExchange produceert geldig XML voor leeg model", () => {
    const xml = serializeOpenExchange({
      version: "archimate-4.0",
      name: "Leeg",
      elements: [],
      relationships: [],
      views: [],
    });
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('xmlns="http://www.opengroup.org/xsd/archimate/4.0/"');
    expect(xml).toContain("Leeg");
  });

  it("Viewer wordt geëxporteerd als class", () => {
    expect(Viewer).toBeTypeOf("function");
    expect(Viewer.prototype.importXML).toBeTypeOf("function");
    expect(Viewer.prototype.destroy).toBeTypeOf("function");
  });
});

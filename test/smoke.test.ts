/**
 * Smoke-test suite voor archimate-js M1-week-1 skeleton.
 *
 * Vult zich tijdens M1 met:
 *  - Round-trip parser-tests op 20 referentiemodellen
 *  - Renderer-output-tests (jsdom + tiny-svg)
 *  - Public-API contract-tests (Viewer constructor + lifecycle)
 */

import { describe, it, expect } from "vitest";

import { parseOpenExchange, serializeOpenExchange } from "../src/index.js";

describe("archimate-js skeleton", () => {
  it("exports parseOpenExchange (placeholder werpt tot M1-week-1)", () => {
    expect(() => parseOpenExchange("<x/>")).toThrow(/not yet implemented/);
  });

  it("exports serializeOpenExchange (placeholder werpt tot M1-week-1)", () => {
    expect(() =>
      serializeOpenExchange({
        version: "archimate-4.0",
        name: "test",
        elements: [],
        relationships: [],
        views: [],
      }),
    ).toThrow(/not yet implemented/);
  });
});

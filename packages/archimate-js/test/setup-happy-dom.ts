/**
 * Setup voor happy-dom tests: patch SVG-API's die happy-dom (en JSDOM) niet
 * volledig implementeren maar die diagram-js wel aanroept.
 *
 * Dit zijn no-op stubs voor methodes die in een echte browser positie-relevante
 * normalisaties doen, maar voor test-doeleinden niet nodig zijn — we
 * verifiëren rendering-output, niet pixel-perfecte placement.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

function patchSvgPrototypes(): void {
  const w = globalThis as unknown as { SVGTransformList?: any; SVGGraphicsElement?: any };
  if (
    typeof w.SVGTransformList === "function" &&
    typeof w.SVGTransformList.prototype.consolidate !== "function"
  ) {
    w.SVGTransformList.prototype.consolidate = function consolidate(): null {
      return null;
    };
  }

  // happy-dom's createSVGMatrix / createSVGTransform implementaties ontbreken.
  if (typeof w.SVGGraphicsElement === "function") {
    const proto = w.SVGGraphicsElement.prototype;
    if (typeof proto.getCTM !== "function") {
      proto.getCTM = function getCTM(): null {
        return null;
      };
    }
    if (typeof proto.getScreenCTM !== "function") {
      proto.getScreenCTM = function getScreenCTM(): null {
        return null;
      };
    }
  }
}

patchSvgPrototypes();

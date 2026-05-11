/**
 * Setup voor happy-dom tests: patch SVG-API's die happy-dom niet volledig
 * implementeert maar die diagram-js wel aanroept.
 *
 * Identiek patroon aan archimate-js/test/setup-happy-dom.ts.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

function patchSvgPrototypes(): void {
  const w = globalThis as unknown as {
    SVGTransformList?: any;
    SVGGraphicsElement?: any;
  };

  if (
    typeof w.SVGTransformList === "function" &&
    typeof w.SVGTransformList.prototype.consolidate !== "function"
  ) {
    w.SVGTransformList.prototype.consolidate = function consolidate(): null {
      return null;
    };
  }

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

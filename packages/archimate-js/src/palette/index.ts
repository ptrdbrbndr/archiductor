/**
 * archimate-js palette module — provides drag-handles voor 3 ArchiMate-elementen
 * tijdens M4-a (minimum viable editor). Uitbreiding naar volledige paletselectie
 * (~30 elementen) komt in M4-b/c.
 *
 * Patroon: diagram-js PaletteProvider — getPaletteEntries() returneert een map
 * van entries; elke entry heeft een drag-handler die `create.start(event, shape)`
 * aanroept. Diagram-js handelt dragging + drop + Modeling.createShape af.
 *
 * Element-defaults (size + businessObject) zijn lokaal — geen layout-engine in
 * M4-a; geplaatste elementen krijgen 120×55 (rechthoek-laag-stijl) of 120×60
 * (round-cornered actor-stijl in M4-b).
 */

import type { ArchiLayer } from "../types.js";

interface DragEventLike {
  preventDefault?: () => void;
}

interface ElementFactory {
  createShape: (props: Record<string, unknown>) => unknown;
}

interface Create {
  start: (event: DragEventLike, shape: unknown) => void;
}

interface Palette {
  registerProvider: (provider: ArchiMatePaletteProvider) => void;
}

interface ArchiMateElementSpec {
  archimateType: string;
  layer: ArchiLayer;
  defaultName: string;
  width: number;
  height: number;
}

const M4_A_ELEMENTS: Record<string, ArchiMateElementSpec> = {
  "create.business-actor": {
    archimateType: "BusinessActor",
    layer: "business",
    defaultName: "Business Actor",
    width: 140,
    height: 60,
  },
  "create.business-process": {
    archimateType: "BusinessProcess",
    layer: "business",
    defaultName: "Business Process",
    width: 140,
    height: 60,
  },
  "create.application-component": {
    archimateType: "ApplicationComponent",
    layer: "application",
    defaultName: "Application Component",
    width: 140,
    height: 60,
  },
};

class ArchiMatePaletteProvider {
  static $inject = ["palette", "create", "elementFactory"];

  private _create: Create;
  private _elementFactory: ElementFactory;

  constructor(palette: Palette, create: Create, elementFactory: ElementFactory) {
    this._create = create;
    this._elementFactory = elementFactory;
    palette.registerProvider(this);
  }

  getPaletteEntries() {
    const entries: Record<string, unknown> = {};

    for (const [id, spec] of Object.entries(M4_A_ELEMENTS)) {
      entries[id] = {
        group: spec.layer,
        className: `archi-palette-icon archi-${spec.archimateType.toLowerCase()}`,
        title: spec.defaultName,
        action: {
          dragstart: (event: DragEventLike) => this._startCreate(event, spec),
          click: (event: DragEventLike) => this._startCreate(event, spec),
        },
      };
    }

    entries["business-separator"] = { group: "business", separator: true };
    entries["application-separator"] = { group: "application", separator: true };

    return entries;
  }

  private _startCreate(event: DragEventLike, spec: ArchiMateElementSpec) {
    const shape = this._elementFactory.createShape({
      width: spec.width,
      height: spec.height,
      businessObject: {
        elementId: generateElementId(spec.archimateType),
        archimateType: spec.archimateType,
        layer: spec.layer,
        name: spec.defaultName,
      },
    });
    this._create.start(event, shape);
  }
}

function generateElementId(type: string): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `${type.toLowerCase()}-${suffix}`;
}

export const paletteModule = {
  __init__: ["paletteProvider"],
  paletteProvider: ["type", ArchiMatePaletteProvider],
};

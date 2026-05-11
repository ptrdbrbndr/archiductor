/**
 * archimate-js
 *
 * ArchiMate 3.2 + 4.0 viewer and modeler on diagram-js.
 *
 * Public API (M4-a in progress; not stable until first tagged release):
 *  - Viewer       — read-only renderer for OEF XML models (M1)
 *  - Modeler      — read/write renderer met palette + command-stack (M4-a; uitbreiding M4-b/c)
 *  - parseOpenExchange(xml) — pure parser, returns ArchiModel
 *  - serializeOpenExchange(model) — pure serializer, returns OEF XML
 *  - render module exports for advanced consumers who want custom diagram-js setup
 *  - palette module export voor consumers die eigen palette-extensies willen mounten
 */

export { Viewer } from "./Viewer.js";
export type { ViewerOptions } from "./Viewer.js";
export { Modeler } from "./Modeler.js";
export type { ModelerOptions } from "./Modeler.js";
export { renderModule } from "./render/index.js";
export { paletteModule } from "./palette/index.js";
export { parseOpenExchange, serializeOpenExchange } from "./parse/index.js";
export { detectLayer } from "./archimate-layers.js";
export type {
  ArchiModel,
  ArchiElement,
  ArchiRelationship,
  ArchiView,
  ArchiViewNode,
  ArchiViewConnection,
  ArchiLayer,
  ArchiRelationshipType,
} from "./types.js";

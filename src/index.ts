/**
 * archimate-js
 *
 * ArchiMate 3.2 + 4.0 viewer and modeler on diagram-js.
 *
 * Public API (M1 in progress; not stable until first tagged release):
 *  - Viewer       — read-only renderer for OEF XML models
 *  - Modeler      — TBD (M4)
 *  - parseOpenExchange(xml) — pure parser, returns ArchiModel
 *  - serializeOpenExchange(model) — pure serializer, returns OEF XML
 *  - render module exports for advanced consumers who want custom diagram-js setup
 */

export { Viewer } from "./Viewer.js";
export type { ViewerOptions } from "./Viewer.js";
export { renderModule } from "./render/index.js";
export { parseOpenExchange, serializeOpenExchange } from "./parse/index.js";
export type {
  ArchiModel,
  ArchiElement,
  ArchiRelationship,
  ArchiView,
  ArchiLayer,
  ArchiRelationshipType,
} from "./types.js";

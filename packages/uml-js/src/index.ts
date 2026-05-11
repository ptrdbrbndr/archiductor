/**
 * uml-js
 *
 * UML 2.5 class diagram viewer op diagram-js.
 *
 * Publieke API (v0.0.1 — class diagrams; sequence, use case en component
 * volgen in Task 2-3):
 *  - Viewer          — read-only renderer voor Eclipse UML2 XMI 2.5
 *  - parseXmi(xml)   — pure parser, geeft UmlModel terug
 *  - renderModule    — diagram-js module export voor advanced consumers
 */

export { Viewer } from "./Viewer.js";
export type { ViewerOptions } from "./Viewer.js";
export { parseXmi } from "./parser/XmiParser.js";
export { renderModule } from "./render/index.js";
export { computeGridLayout } from "./layout/gridLayout.js";
export type { ClassLayout } from "./layout/gridLayout.js";
export type {
  UmlModel,
  UmlClass,
  UmlAttribute,
  UmlOperation,
  UmlParameter,
  UmlRelation,
  UmlRelationType,
  UmlVisibility,
} from "./types.js";

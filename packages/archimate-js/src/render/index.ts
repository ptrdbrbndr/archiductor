/**
 * Render module — didi DI export voor diagram-js' Diagram constructor.
 *
 * Tijdens M1 wordt deze uitgebouwd met:
 *  - 7 ArchiMate-laag-renderers (zie ArchiMateRenderer)
 *  - 11 connection-renderers (zie ./connections/)
 *
 * Patroon volgt bpmn-js BpmnRenderer:
 * https://github.com/bpmn-io/bpmn-js/blob/develop/lib/draw/BpmnRenderer.js
 */

import { ArchiMateRenderer } from "./ArchiMateRenderer.js";

export const renderModule = {
  __init__: ["archimateRenderer"],
  archimateRenderer: ["type", ArchiMateRenderer],
};

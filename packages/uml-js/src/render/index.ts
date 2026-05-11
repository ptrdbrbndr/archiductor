/**
 * Render module — diagram-js DI export voor UML class diagram renderer.
 *
 * Patroon identiek aan archimate-js renderModule.
 */

import { UmlRenderer } from "./UmlRenderer.js";

export const renderModule = {
  __init__: ["umlRenderer"],
  umlRenderer: ["type", UmlRenderer],
};

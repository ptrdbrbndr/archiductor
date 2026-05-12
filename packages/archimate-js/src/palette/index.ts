/**
 * archimate-js palette module — drag-handles voor alle gangbare ArchiMate-elementen
 * over 7 lagen (M4 volledig). Gebaseerd op ArchiMate 4.0 spec.
 *
 * Patroon: diagram-js PaletteProvider — getPaletteEntries() returneert een map
 * van entries; elke entry heeft een drag-handler die `create.start(event, shape)`
 * aanroept. Diagram-js handelt dragging + drop + Modeling.createShape af.
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

const ARCHIMATE_ELEMENTS: Record<string, ArchiMateElementSpec> = {
  // ── Motivation ────────────────────────────────────────────────────────────
  "create.stakeholder":        { archimateType: "Stakeholder",        layer: "motivation",       defaultName: "Stakeholder",         width: 140, height: 60 },
  "create.driver":             { archimateType: "Driver",             layer: "motivation",       defaultName: "Driver",              width: 140, height: 60 },
  "create.assessment":         { archimateType: "Assessment",         layer: "motivation",       defaultName: "Assessment",          width: 140, height: 60 },
  "create.goal":               { archimateType: "Goal",               layer: "motivation",       defaultName: "Goal",                width: 140, height: 60 },
  "create.outcome":            { archimateType: "Outcome",            layer: "motivation",       defaultName: "Outcome",             width: 140, height: 60 },
  "create.principle":          { archimateType: "Principle",          layer: "motivation",       defaultName: "Principle",           width: 140, height: 60 },
  "create.requirement":        { archimateType: "Requirement",        layer: "motivation",       defaultName: "Requirement",         width: 140, height: 60 },
  "create.constraint":         { archimateType: "Constraint",         layer: "motivation",       defaultName: "Constraint",          width: 140, height: 60 },
  "create.meaning":            { archimateType: "Meaning",            layer: "motivation",       defaultName: "Meaning",             width: 140, height: 60 },
  "create.value":              { archimateType: "Value",              layer: "motivation",       defaultName: "Value",               width: 140, height: 60 },

  // ── Strategy ──────────────────────────────────────────────────────────────
  "create.resource":           { archimateType: "Resource",           layer: "strategy",         defaultName: "Resource",            width: 140, height: 60 },
  "create.capability":         { archimateType: "Capability",         layer: "strategy",         defaultName: "Capability",          width: 140, height: 60 },
  "create.value-stream":       { archimateType: "ValueStream",        layer: "strategy",         defaultName: "Value Stream",        width: 140, height: 60 },
  "create.course-of-action":   { archimateType: "CourseOfAction",     layer: "strategy",         defaultName: "Course Of Action",    width: 140, height: 60 },

  // ── Business ──────────────────────────────────────────────────────────────
  "create.business-actor":         { archimateType: "BusinessActor",         layer: "business", defaultName: "Business Actor",         width: 140, height: 60 },
  "create.business-role":          { archimateType: "BusinessRole",          layer: "business", defaultName: "Business Role",          width: 140, height: 60 },
  "create.business-collaboration": { archimateType: "BusinessCollaboration", layer: "business", defaultName: "Business Collaboration", width: 140, height: 60 },
  "create.business-interface":     { archimateType: "BusinessInterface",     layer: "business", defaultName: "Business Interface",     width: 140, height: 60 },
  "create.business-process":       { archimateType: "BusinessProcess",       layer: "business", defaultName: "Business Process",       width: 140, height: 60 },
  "create.business-function":      { archimateType: "BusinessFunction",      layer: "business", defaultName: "Business Function",      width: 140, height: 60 },
  "create.business-interaction":   { archimateType: "BusinessInteraction",   layer: "business", defaultName: "Business Interaction",   width: 140, height: 60 },
  "create.business-event":         { archimateType: "BusinessEvent",         layer: "business", defaultName: "Business Event",         width: 140, height: 60 },
  "create.business-service":       { archimateType: "BusinessService",       layer: "business", defaultName: "Business Service",       width: 140, height: 60 },
  "create.business-object":        { archimateType: "BusinessObject",        layer: "business", defaultName: "Business Object",        width: 140, height: 60 },
  "create.contract":               { archimateType: "Contract",              layer: "business", defaultName: "Contract",               width: 140, height: 60 },
  "create.product":                { archimateType: "Product",               layer: "business", defaultName: "Product",                width: 140, height: 60 },

  // ── Application ───────────────────────────────────────────────────────────
  "create.application-component":     { archimateType: "ApplicationComponent",     layer: "application", defaultName: "Application Component",     width: 140, height: 60 },
  "create.application-collaboration": { archimateType: "ApplicationCollaboration", layer: "application", defaultName: "Application Collaboration", width: 140, height: 60 },
  "create.application-interface":     { archimateType: "ApplicationInterface",     layer: "application", defaultName: "Application Interface",     width: 140, height: 60 },
  "create.application-function":      { archimateType: "ApplicationFunction",      layer: "application", defaultName: "Application Function",      width: 140, height: 60 },
  "create.application-interaction":   { archimateType: "ApplicationInteraction",   layer: "application", defaultName: "Application Interaction",   width: 140, height: 60 },
  "create.application-process":       { archimateType: "ApplicationProcess",       layer: "application", defaultName: "Application Process",       width: 140, height: 60 },
  "create.application-event":         { archimateType: "ApplicationEvent",         layer: "application", defaultName: "Application Event",         width: 140, height: 60 },
  "create.application-service":       { archimateType: "ApplicationService",       layer: "application", defaultName: "Application Service",       width: 140, height: 60 },
  "create.data-object":               { archimateType: "DataObject",               layer: "application", defaultName: "Data Object",               width: 140, height: 60 },

  // ── Technology ────────────────────────────────────────────────────────────
  "create.node":                   { archimateType: "Node",                   layer: "technology", defaultName: "Node",                    width: 140, height: 60 },
  "create.device":                 { archimateType: "Device",                 layer: "technology", defaultName: "Device",                  width: 140, height: 60 },
  "create.system-software":        { archimateType: "SystemSoftware",         layer: "technology", defaultName: "System Software",         width: 140, height: 60 },
  "create.technology-collaboration":{ archimateType: "TechnologyCollaboration",layer: "technology", defaultName: "Technology Collaboration",width: 140, height: 60 },
  "create.technology-interface":   { archimateType: "TechnologyInterface",    layer: "technology", defaultName: "Technology Interface",    width: 140, height: 60 },
  "create.path":                   { archimateType: "Path",                   layer: "technology", defaultName: "Path",                    width: 140, height: 60 },
  "create.communication-network":  { archimateType: "CommunicationNetwork",   layer: "technology", defaultName: "Communication Network",   width: 140, height: 60 },
  "create.technology-function":    { archimateType: "TechnologyFunction",     layer: "technology", defaultName: "Technology Function",     width: 140, height: 60 },
  "create.technology-process":     { archimateType: "TechnologyProcess",      layer: "technology", defaultName: "Technology Process",      width: 140, height: 60 },
  "create.technology-service":     { archimateType: "TechnologyService",      layer: "technology", defaultName: "Technology Service",      width: 140, height: 60 },
  "create.artifact":               { archimateType: "Artifact",               layer: "technology", defaultName: "Artifact",                width: 140, height: 60 },

  // ── Physical ──────────────────────────────────────────────────────────────
  "create.equipment":              { archimateType: "Equipment",              layer: "physical",   defaultName: "Equipment",              width: 140, height: 60 },
  "create.facility":               { archimateType: "Facility",               layer: "physical",   defaultName: "Facility",               width: 140, height: 60 },
  "create.distribution-network":   { archimateType: "DistributionNetwork",    layer: "physical",   defaultName: "Distribution Network",   width: 140, height: 60 },
  "create.material":               { archimateType: "Material",               layer: "physical",   defaultName: "Material",               width: 140, height: 60 },

  // ── Implementation & Migration ────────────────────────────────────────────
  "create.work-package":           { archimateType: "WorkPackage",            layer: "implementation", defaultName: "Work Package",       width: 140, height: 60 },
  "create.deliverable":            { archimateType: "Deliverable",            layer: "implementation", defaultName: "Deliverable",        width: 140, height: 60 },
  "create.implementation-event":   { archimateType: "ImplementationEvent",    layer: "implementation", defaultName: "Implementation Event", width: 140, height: 60 },
  "create.plateau":                { archimateType: "Plateau",                layer: "implementation", defaultName: "Plateau",            width: 140, height: 60 },
  "create.gap":                    { archimateType: "Gap",                    layer: "implementation", defaultName: "Gap",                width: 140, height: 60 },
};

const LAYER_ORDER: ArchiLayer[] = [
  "motivation",
  "strategy",
  "business",
  "application",
  "technology",
  "physical",
  "implementation",
];

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

    for (const [id, spec] of Object.entries(ARCHIMATE_ELEMENTS)) {
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

    // Separators na elke laaggroep (behalve de laatste)
    for (let i = 0; i < LAYER_ORDER.length - 1; i++) {
      entries[`separator-${LAYER_ORDER[i]}`] = {
        group: LAYER_ORDER[i],
        separator: true,
      };
    }

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

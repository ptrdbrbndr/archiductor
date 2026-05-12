// ArchiMate 3.x type definitions

export type ArchiMateLayer = "Business" | "Application" | "Technology" | "Motivation" | "Implementation" | "Strategy";

export type ArchiMateRelationType =
  | "Association"
  | "Access"
  | "Influence"
  | "Triggering"
  | "Flow"
  | "Specialization"
  | "Aggregation"
  | "Composition"
  | "Realization"
  | "Assignment"
  | "Serving";

export type ArchiMateViewpointType =
  | "Organization"
  | "Actor_Cooperation"
  | "Business_Process"
  | "Business_Function"
  | "Business_Interaction"
  | "Product"
  | "Application_Usage"
  | "Application_Cooperation"
  | "Application_Behavior"
  | "Technology_Usage"
  | "Infrastructure_Usage"
  | "Infrastructure"
  | "Implementation_Deployment"
  | "Information_Structure"
  | "Service_Realization"
  | "Layered"
  | "Physical"
  | "Total"
  | string; // allow custom viewpoint types from Open Exchange Format

export interface ArchiMateProperty {
  key: string;
  value: string;
}

export interface ArchiMateElement {
  id: string;
  name: string;
  type: string;           // e.g. "BusinessActor", "ApplicationComponent", "TechnologyService"
  layer: ArchiMateLayer;
  documentation?: string;
  properties?: ArchiMateProperty[];
}

export interface ArchiMateRelation {
  id: string;
  type: ArchiMateRelationType;
  sourceId: string;
  targetId: string;
  name?: string;
  documentation?: string;
  properties?: ArchiMateProperty[];
}

export interface ArchiMateViewNode {
  elementId: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export interface ArchiMateViewConnection {
  relationId: string;
}

export interface ArchiMateView {
  id: string;
  name: string;
  viewpointType?: ArchiMateViewpointType;
  elementIds: string[];
  relationIds: string[];
  nodes?: ArchiMateViewNode[];
  connections?: ArchiMateViewConnection[];
}

export interface ArchiMateModel {
  id: string;
  name: string;
  documentation?: string;
  elements: ArchiMateElement[];
  relations: ArchiMateRelation[];
  views: ArchiMateView[];
}

// Layer inference map: element type prefix → layer
export const ELEMENT_TYPE_LAYER_MAP: Record<string, ArchiMateLayer> = {
  Business: "Business",
  Application: "Application",
  Technology: "Technology",
  Physical: "Technology",
  Motivation: "Motivation",
  Implementation: "Implementation",
  Strategy: "Strategy",
};

/**
 * Infer the ArchiMate layer from an element type string.
 * E.g. "BusinessActor" → "Business", "ApplicationComponent" → "Application"
 */
export function inferLayer(elementType: string): ArchiMateLayer {
  for (const [prefix, layer] of Object.entries(ELEMENT_TYPE_LAYER_MAP)) {
    if (elementType.startsWith(prefix)) {
      return layer;
    }
  }
  // Fallback for types without a clear prefix
  return "Business";
}

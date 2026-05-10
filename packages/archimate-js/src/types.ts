/**
 * In-memory ArchiMate model — taal-agnostische TypeScript types.
 *
 * Mapping naar de Open Exchange Format XSD:
 *  - <element> → ArchiElement
 *  - <relationship> → ArchiRelationship
 *  - <view> → ArchiView
 *  - <documentation>, <properties> → string fields op de container
 *
 * Spec references:
 *  - ArchiMate 3.2: https://pubs.opengroup.org/architecture/archimate3-doc/
 *  - ArchiMate 4.0: https://pubs.opengroup.org/architecture/archimate4-doc/
 */

export type ArchiLayer =
  | "business"
  | "application"
  | "technology"
  | "motivation"
  | "strategy"
  | "physical"
  | "implementation";

export type ArchiRelationshipType =
  | "Composition"
  | "Aggregation"
  | "Assignment"
  | "Realization"
  | "Triggering"
  | "Flow"
  | "Influence"
  | "Access"
  | "UsedBy"
  | "Specialization"
  | "Association";

export interface ArchiElement {
  id: string;
  name: string;
  /** ArchiMate element type, e.g. "BusinessProcess", "ApplicationComponent". */
  type: string;
  layer: ArchiLayer;
  documentation?: string;
  properties?: Record<string, string>;
}

export interface ArchiRelationship {
  id: string;
  type: ArchiRelationshipType;
  source: string;
  target: string;
  name?: string;
  documentation?: string;
  properties?: Record<string, string>;
}

export interface ArchiViewNode {
  id: string;
  /** Reference to ArchiElement.id. */
  elementRef: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ArchiViewConnection {
  id: string;
  /** Reference to ArchiRelationship.id. */
  relationshipRef: string;
  sourceNodeRef: string;
  targetNodeRef: string;
  /**
   * Intermediate bendpoints between source and target nodes (geen start/end —
   * die worden door de renderer berekend uit de node-bboxes).
   * Komt 1-op-1 uit OEF `<bendpoint x= y= />` kinderen.
   */
  bendpoints: { x: number; y: number }[];
}

export interface ArchiView {
  id: string;
  name: string;
  viewpoint?: string;
  nodes: ArchiViewNode[];
  connections: ArchiViewConnection[];
}

export interface ArchiModel {
  /** "archimate-3.2" | "archimate-4.0" */
  version: "archimate-3.2" | "archimate-4.0";
  name: string;
  documentation?: string;
  elements: ArchiElement[];
  relationships: ArchiRelationship[];
  views: ArchiView[];
}

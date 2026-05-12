export type ArchiMateLayer =
  | 'motivation'
  | 'strategy'
  | 'business'
  | 'application'
  | 'technology'
  | 'physical'
  | 'implementation_migration';

export type ArchiMateElementType =
  | 'Stakeholder' | 'Driver' | 'Assessment' | 'Goal' | 'Outcome'
  | 'Principle' | 'Requirement' | 'Constraint' | 'Meaning' | 'Value'
  | 'Resource' | 'Capability' | 'CourseOfAction' | 'ValueStream'
  | 'BusinessActor' | 'BusinessRole' | 'BusinessCollaboration'
  | 'BusinessInterface' | 'BusinessProcess' | 'BusinessFunction'
  | 'BusinessInteraction' | 'BusinessEvent' | 'BusinessService'
  | 'BusinessObject' | 'Contract' | 'Representation' | 'Product'
  | 'ApplicationComponent' | 'ApplicationCollaboration'
  | 'ApplicationInterface' | 'ApplicationFunction' | 'ApplicationInteraction'
  | 'ApplicationProcess' | 'ApplicationEvent' | 'ApplicationService' | 'DataObject'
  | 'Node' | 'Device' | 'SystemSoftware' | 'TechnologyCollaboration'
  | 'TechnologyInterface' | 'Path' | 'CommunicationNetwork'
  | 'TechnologyFunction' | 'TechnologyProcess' | 'TechnologyInteraction'
  | 'TechnologyEvent' | 'TechnologyService' | 'Artifact'
  | 'Equipment' | 'Facility' | 'DistributionNetwork' | 'Material'
  | 'WorkPackage' | 'Deliverable' | 'ImplementationEvent' | 'Plateau' | 'Gap'
  | 'Grouping' | 'Location' | 'Junction';

export type ArchiMateRelationType =
  | 'Association' | 'Specialization' | 'Realization' | 'Composition'
  | 'Aggregation' | 'Assignment' | 'Serving' | 'Access'
  | 'Influence' | 'Triggering' | 'Flow';

export const ELEMENT_LAYER: Record<string, ArchiMateLayer> = {
  Stakeholder: 'motivation', Driver: 'motivation', Assessment: 'motivation',
  Goal: 'motivation', Outcome: 'motivation', Principle: 'motivation',
  Requirement: 'motivation', Constraint: 'motivation', Meaning: 'motivation', Value: 'motivation',
  Resource: 'strategy', Capability: 'strategy', CourseOfAction: 'strategy', ValueStream: 'strategy',
  BusinessActor: 'business', BusinessRole: 'business', BusinessCollaboration: 'business',
  BusinessInterface: 'business', BusinessProcess: 'business', BusinessFunction: 'business',
  BusinessInteraction: 'business', BusinessEvent: 'business', BusinessService: 'business',
  BusinessObject: 'business', Contract: 'business', Representation: 'business', Product: 'business',
  ApplicationComponent: 'application', ApplicationCollaboration: 'application',
  ApplicationInterface: 'application', ApplicationFunction: 'application',
  ApplicationInteraction: 'application', ApplicationProcess: 'application',
  ApplicationEvent: 'application', ApplicationService: 'application', DataObject: 'application',
  Node: 'technology', Device: 'technology', SystemSoftware: 'technology',
  TechnologyCollaboration: 'technology', TechnologyInterface: 'technology',
  Path: 'technology', CommunicationNetwork: 'technology', TechnologyFunction: 'technology',
  TechnologyProcess: 'technology', TechnologyInteraction: 'technology',
  TechnologyEvent: 'technology', TechnologyService: 'technology', Artifact: 'technology',
  Equipment: 'physical', Facility: 'physical', DistributionNetwork: 'physical', Material: 'physical',
  WorkPackage: 'implementation_migration', Deliverable: 'implementation_migration',
  ImplementationEvent: 'implementation_migration', Plateau: 'implementation_migration',
  Gap: 'implementation_migration',
  Grouping: 'application', Location: 'business', Junction: 'application',
};

export type ArchiMateViewpointType = string;

export function inferLayer(type: string): ArchiMateLayer {
  return ELEMENT_LAYER[type] ?? 'application';
}

export interface ArchiMateProperty {
  key: string;
  value: string;
}

export interface ArchiMateElement {
  id: string;
  name: string;
  type: ArchiMateElementType;
  layer: ArchiMateLayer;
  documentation?: string;
  properties: ArchiMateProperty[];
}

export interface ArchiMateRelation {
  id: string;
  type: ArchiMateRelationType;
  sourceId: string;
  targetId: string;
  name?: string;
  documentation?: string;
  properties: ArchiMateProperty[];
}

export interface ArchiMateViewElement {
  elementId: string;
}

export interface ArchiMateView {
  id: string;
  name: string;
  viewpoint?: string;
  elements: ArchiMateViewElement[];
  relations: string[];
}

export interface ArchiMateModel {
  id: string;
  name: string;
  documentation?: string;
  elements: Map<string, ArchiMateElement>;
  relations: Map<string, ArchiMateRelation>;
  views: Map<string, ArchiMateView>;
}

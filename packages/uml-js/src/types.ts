/**
 * In-memory UML 2.5 class diagram model — taal-agnostische TypeScript types.
 *
 * Mapping naar Eclipse UML2 XMI 2.5:
 *  - <packagedElement xmi:type="uml:Class"> → UmlClass
 *  - <packagedElement xmi:type="uml:Interface"> → UmlClass (isInterface=true)
 *  - <ownedAttribute> → UmlAttribute
 *  - <ownedOperation> → UmlOperation
 *  - <packagedElement xmi:type="uml:Association"> → UmlRelation (type=association)
 *  - <generalization> → UmlRelation (type=generalization)
 *  - <interfaceRealization> → UmlRelation (type=realization)
 *  - <packagedElement xmi:type="uml:Usage"> → UmlRelation (type=dependency)
 *
 * Spec: UML 2.5 — https://www.omg.org/spec/UML/2.5.1/PDF
 */

export type UmlVisibility = "public" | "protected" | "private" | "package";

export type UmlRelationType =
  | "association"
  | "generalization"
  | "realization"
  | "dependency"
  | "aggregation"
  | "composition";

export interface UmlAttribute {
  name: string;
  type: string;
  visibility: UmlVisibility;
  isStatic: boolean;
}

export interface UmlParameter {
  name: string;
  type: string;
}

export interface UmlOperation {
  name: string;
  returnType: string;
  visibility: UmlVisibility;
  parameters: UmlParameter[];
}

export interface UmlClass {
  id: string;
  name: string;
  isAbstract: boolean;
  isInterface: boolean;
  stereotype?: string;
  attributes: UmlAttribute[];
  operations: UmlOperation[];
}

export interface UmlRelation {
  id: string;
  type: UmlRelationType;
  sourceId: string;
  targetId: string;
  name?: string;
}

export interface UmlModel {
  name: string;
  classes: UmlClass[];
  relations: UmlRelation[];
}

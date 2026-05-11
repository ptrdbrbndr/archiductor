/**
 * In-memory UML 2.5 model — taal-agnostische TypeScript types.
 *
 * Ondersteunde diagramtypen:
 *  - class      → UmlClassDiagram (UmlClass + UmlRelation)
 *  - sequence   → UmlSequenceDiagram (UmlLifeline + UmlMessage + UmlFragment)
 *  - usecase    → UmlUseCaseDiagram (UmlActor + UmlUseCase + UmlUseCaseRelation)
 *  - component  → UmlComponentDiagram (UmlComponent + UmlComponentRelation)
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
 *  - <packagedElement xmi:type="uml:Interaction"> → UmlSequenceDiagram
 *  - <packagedElement xmi:type="uml:Actor"> → UmlActor
 *  - <packagedElement xmi:type="uml:UseCase"> → UmlUseCase
 *  - <packagedElement xmi:type="uml:Component"> → UmlComponent
 *
 * Spec: UML 2.5 — https://www.omg.org/spec/UML/2.5.1/PDF
 */

export type UmlDiagramType = "class" | "sequence" | "usecase" | "component";

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

// ─── Sequence diagram types ───────────────────────────────────────────────────

export type UmlMessageType = "sync" | "async" | "return" | "create" | "destroy";

export interface UmlLifeline {
  id: string;
  name: string;
  /** "Actor" of naam van een class/object */
  type?: string;
}

export interface UmlMessage {
  id: string;
  /** Lifeline-id van de afzender */
  from: string;
  /** Lifeline-id van de ontvanger */
  to: string;
  label: string;
  type: UmlMessageType;
  /** Volgorde (oplopend bepaalt y-positie) */
  order: number;
}

export interface UmlFragment {
  id: string;
  operator: "loop" | "alt" | "opt" | "par" | "ref";
  label?: string;
  operands: string[];
}

export interface UmlSequenceDiagram {
  type: "sequence";
  lifelines: UmlLifeline[];
  messages: UmlMessage[];
  fragments: UmlFragment[];
}

// ─── Use case diagram types ───────────────────────────────────────────────────

export interface UmlActor {
  id: string;
  name: string;
}

export interface UmlUseCase {
  id: string;
  name: string;
  description?: string;
}

export type UmlUseCaseRelationType =
  | "association"
  | "include"
  | "extend"
  | "generalization";

export interface UmlUseCaseRelation {
  id: string;
  type: UmlUseCaseRelationType;
  sourceId: string;
  targetId: string;
  label?: string;
}

export interface UmlUseCaseDiagram {
  type: "usecase";
  actors: UmlActor[];
  useCases: UmlUseCase[];
  relations: UmlUseCaseRelation[];
  systemBoundary?: string;
}

// ─── Component diagram types ──────────────────────────────────────────────────

export interface UmlComponent {
  id: string;
  name: string;
  stereotype?: string;
  providedInterfaces: string[];
  requiredInterfaces: string[];
}

export type UmlComponentRelationType = "dependency" | "realization" | "usage";

export interface UmlComponentRelation {
  id: string;
  type: UmlComponentRelationType;
  sourceId: string;
  targetId: string;
}

export interface UmlComponentDiagram {
  type: "component";
  components: UmlComponent[];
  relations: UmlComponentRelation[];
}

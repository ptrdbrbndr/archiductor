/**
 * Mapping van ArchiMate-element-types naar lagen.
 *
 * Niet exhaustief voor 100% van de spec — dekt de gangbare types. Onbekende
 * types vallen terug op `business` (safest visual default — gele rect).
 *
 * Referenties:
 *  - ArchiMate 3.2 specification (Open Group, 2019)
 *  - ArchiMate 4.0 specification (Open Group, 2024) — voegt o.a. Physical-laag
 *    en aangepaste Strategy-elementen toe
 */

import type { ArchiLayer } from "./types.js";

const TECHNOLOGY_TYPES = new Set([
  "Node",
  "Device",
  "SystemSoftware",
  "TechnologyCollaboration",
  "TechnologyInterface",
  "Path",
  "CommunicationNetwork",
  "TechnologyFunction",
  "TechnologyProcess",
  "TechnologyInteraction",
  "TechnologyEvent",
  "TechnologyService",
  "Artifact",
]);

const MOTIVATION_TYPES = new Set([
  "Stakeholder",
  "Driver",
  "Assessment",
  "Goal",
  "Outcome",
  "Principle",
  "Requirement",
  "Constraint",
  "Meaning",
  "Value",
]);

const STRATEGY_TYPES = new Set([
  "Resource",
  "Capability",
  "ValueStream",
  "CourseOfAction",
]);

const PHYSICAL_TYPES = new Set([
  "Equipment",
  "Facility",
  "DistributionNetwork",
  "Material",
]);

const IMPLEMENTATION_TYPES = new Set([
  "WorkPackage",
  "Deliverable",
  "ImplementationEvent",
  "Plateau",
  "Gap",
]);

export function detectLayer(elementType: string): ArchiLayer {
  if (elementType.startsWith("Business")) return "business";
  if (elementType.startsWith("Application")) return "application";
  if (TECHNOLOGY_TYPES.has(elementType)) return "technology";
  if (MOTIVATION_TYPES.has(elementType)) return "motivation";
  if (STRATEGY_TYPES.has(elementType)) return "strategy";
  if (PHYSICAL_TYPES.has(elementType)) return "physical";
  if (IMPLEMENTATION_TYPES.has(elementType)) return "implementation";
  return "business";
}

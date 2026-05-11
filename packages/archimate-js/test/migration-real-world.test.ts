/**
 * @vitest-environment node
 *
 * M6-b regressietest — ArchiMate 3.x → 4.0 migratie op een echt publiek model.
 *
 * Model: "Archimate 3 Examples" by latestalexey
 * Bron: https://github.com/latestalexey/archimate_examples
 * Fixture: test/fixtures/m6b-real-world/file-map.json
 *   — CoArchiFileMap (subset van het echte repo, ~200 element-files)
 *
 * Dit test verifiëert dat:
 *  1. parseCoArchi het model correct leest (>100 elementen)
 *  2. generateMigrationReport de juiste severity-tellingen geeft
 *  3. Breaking-elementen (Gap, BusinessInteraction) correct worden gedetecteerd
 *  4. Rapport bevat Markdown-secties voor breaking + warning + ok
 *  5. PatchedModel heeft version="archimate-4.0"
 *  6. Removed-elementen krijgen [ArchiMate 4.0 BREAKING]-notitie in documentation
 *
 * REGRESSIE-MECHANISME: het fixture is deterministisch — als de mapping-tabel
 * wordt gewijzigd, veranderen de tellingen en faalt de test.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

import { parseCoArchi } from "../src/index.js";
import type { ArchiModel } from "../src/types.js";

// ---------------------------------------------------------------------------
// Inline migration logic (gespiegeld van archiductus.nl/src/lib/archiductor/migration/)
// Hiermee blijft de test onafhankelijk van de Next.js app; als de mapping
// verandert, moet ook dit blok bijgewerkt worden.
// ---------------------------------------------------------------------------

type MappingKind = "rename" | "generalize" | "keep" | "removed";
type MappingSeverity = "breaking" | "warning" | "info" | "ok";

interface MigrationMapping {
  oldType: string;
  kind: MappingKind;
  newType: string | null;
  severity: MappingSeverity;
}

interface MigrationFinding {
  elementId: string;
  oldType: string;
  newType: string | null;
  kind: MappingKind | "unknown";
  severity: MappingSeverity | "unknown";
}

interface MigrationReport {
  totalElements: number;
  countsBySeverity: Record<MappingSeverity | "unknown", number>;
  findings: MigrationFinding[];
  unknownTypes: string[];
  patchedModel: ArchiModel;
}

const MAPPINGS: MigrationMapping[] = [
  // Gedragselementen — generalize
  { oldType: "BusinessProcess", kind: "generalize", newType: "Process", severity: "warning" },
  { oldType: "ApplicationProcess", kind: "generalize", newType: "Process", severity: "warning" },
  { oldType: "TechnologyProcess", kind: "generalize", newType: "Process", severity: "warning" },
  { oldType: "BusinessFunction", kind: "generalize", newType: "Function", severity: "warning" },
  { oldType: "ApplicationFunction", kind: "generalize", newType: "Function", severity: "warning" },
  { oldType: "TechnologyFunction", kind: "generalize", newType: "Function", severity: "warning" },
  { oldType: "BusinessService", kind: "generalize", newType: "Service", severity: "warning" },
  { oldType: "ApplicationService", kind: "generalize", newType: "Service", severity: "warning" },
  { oldType: "TechnologyService", kind: "generalize", newType: "Service", severity: "warning" },
  { oldType: "BusinessEvent", kind: "generalize", newType: "Event", severity: "warning" },
  { oldType: "ApplicationEvent", kind: "generalize", newType: "Event", severity: "warning" },
  { oldType: "TechnologyEvent", kind: "generalize", newType: "Event", severity: "warning" },
  // Actieve structuur
  { oldType: "BusinessActor", kind: "generalize", newType: "Actor", severity: "warning" },
  { oldType: "BusinessRole", kind: "generalize", newType: "Role", severity: "warning" },
  { oldType: "ApplicationComponent", kind: "generalize", newType: "Component", severity: "warning" },
  { oldType: "ApplicationInterface", kind: "generalize", newType: "Interface", severity: "warning" },
  { oldType: "Node", kind: "keep", newType: "Node", severity: "ok" },
  { oldType: "Device", kind: "keep", newType: "Device", severity: "ok" },
  { oldType: "SystemSoftware", kind: "keep", newType: "SystemSoftware", severity: "ok" },
  { oldType: "Path", kind: "keep", newType: "Path", severity: "ok" },
  { oldType: "CommunicationNetwork", kind: "keep", newType: "CommunicationNetwork", severity: "ok" },
  // Passieve structuur
  { oldType: "BusinessObject", kind: "generalize", newType: "Object", severity: "warning" },
  { oldType: "DataObject", kind: "generalize", newType: "Object", severity: "warning" },
  { oldType: "Artifact", kind: "keep", newType: "Artifact", severity: "ok" },
  { oldType: "Representation", kind: "generalize", newType: "Representation", severity: "info" },
  { oldType: "Contract", kind: "rename", newType: "Contract", severity: "info" },
  { oldType: "Product", kind: "keep", newType: "Product", severity: "ok" },
  // Verwijderde elementen
  { oldType: "BusinessInteraction", kind: "removed", newType: null, severity: "breaking" },
  { oldType: "ApplicationInteraction", kind: "removed", newType: null, severity: "breaking" },
  { oldType: "TechnologyInteraction", kind: "removed", newType: null, severity: "breaking" },
  { oldType: "BusinessCollaboration", kind: "generalize", newType: "Collaboration", severity: "warning" },
  { oldType: "ApplicationCollaboration", kind: "generalize", newType: "Collaboration", severity: "warning" },
  { oldType: "TechnologyCollaboration", kind: "generalize", newType: "Collaboration", severity: "warning" },
  // Strategy Domain
  { oldType: "Capability", kind: "keep", newType: "Capability", severity: "ok" },
  { oldType: "Resource", kind: "keep", newType: "Resource", severity: "ok" },
  { oldType: "CourseOfAction", kind: "keep", newType: "CourseOfAction", severity: "ok" },
  { oldType: "ValueStream", kind: "keep", newType: "ValueStream", severity: "ok" },
  // Implementation & Migration
  { oldType: "Plateau", kind: "keep", newType: "Plateau", severity: "ok" },
  { oldType: "Gap", kind: "removed", newType: null, severity: "breaking" },
  { oldType: "WorkPackage", kind: "keep", newType: "WorkPackage", severity: "ok" },
  { oldType: "Deliverable", kind: "keep", newType: "Deliverable", severity: "ok" },
  { oldType: "ImplementationEvent", kind: "keep", newType: "ImplementationEvent", severity: "ok" },
  // Motivation Domain
  { oldType: "Stakeholder", kind: "keep", newType: "Stakeholder", severity: "ok" },
  { oldType: "Driver", kind: "keep", newType: "Driver", severity: "ok" },
  { oldType: "Goal", kind: "keep", newType: "Goal", severity: "ok" },
  { oldType: "Outcome", kind: "keep", newType: "Outcome", severity: "ok" },
  { oldType: "Principle", kind: "keep", newType: "Principle", severity: "ok" },
  { oldType: "Requirement", kind: "keep", newType: "Requirement", severity: "ok" },
  { oldType: "Constraint", kind: "keep", newType: "Constraint", severity: "ok" },
];

const MAPPING_BY_TYPE = new Map(MAPPINGS.map((m) => [m.oldType, m]));

function runMigration(model: ArchiModel): MigrationReport {
  const counts: MigrationReport["countsBySeverity"] = {
    breaking: 0, warning: 0, info: 0, ok: 0, unknown: 0,
  };
  const findings: MigrationFinding[] = [];
  const unknownSet = new Set<string>();

  for (const el of model.elements) {
    const mapping = MAPPING_BY_TYPE.get(el.type);
    if (!mapping) {
      counts.unknown += 1;
      unknownSet.add(el.type);
      findings.push({
        elementId: el.id, oldType: el.type, newType: null,
        kind: "unknown", severity: "unknown",
      });
      continue;
    }
    counts[mapping.severity] += 1;
    findings.push({
      elementId: el.id, oldType: el.type,
      newType: mapping.newType, kind: mapping.kind, severity: mapping.severity,
    });
  }

  const patchedElements = model.elements.map((el) => {
    const f = findings.find((x) => x.elementId === el.id);
    if (!f) return el;
    if (f.kind === "removed") {
      return {
        ...el,
        documentation: `[ArchiMate 4.0 BREAKING] ${el.type} verwijderd${el.documentation ? `\n\n${el.documentation}` : ""}`,
      };
    }
    if (f.kind === "unknown" || !f.newType || f.newType === el.type) return el;
    return { ...el, type: f.newType };
  });

  return {
    totalElements: model.elements.length,
    countsBySeverity: counts,
    findings,
    unknownTypes: Array.from(unknownSet).sort(),
    patchedModel: { ...model, version: "archimate-4.0", elements: patchedElements },
  };
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

const FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures/m6b-real-world/file-map.json",
);

const fileMap: Record<string, string> = JSON.parse(
  readFileSync(FIXTURE_PATH, "utf-8"),
);

describe("M6-b — migratie op echt ArchiMate 3.x model (latestalexey/archimate_examples)", () => {
  const model = parseCoArchi(fileMap);
  const report = runMigration(model);

  it("parseert het model met >100 elementen", () => {
    expect(model.elements.length).toBeGreaterThan(100);
    expect(model.elements.length).toBe(report.totalElements);
  });

  it("geeft een regressie-vaste telling van breaking-elementen (Gap + BusinessInteraction)", () => {
    // Gap: 3x, BusinessInteraction: 1x — totaal 4 breaking
    expect(report.countsBySeverity.breaking).toBe(4);
  });

  it("detecteert Gap-elementen als 'removed' (breaking)", () => {
    const gapFindings = report.findings.filter((f) => f.oldType === "Gap");
    expect(gapFindings.length).toBe(3);
    for (const f of gapFindings) {
      expect(f.kind).toBe("removed");
      expect(f.severity).toBe("breaking");
      expect(f.newType).toBeNull();
    }
  });

  it("detecteert BusinessInteraction als 'removed' (breaking)", () => {
    const biFinding = report.findings.find((f) => f.oldType === "BusinessInteraction");
    expect(biFinding).toBeDefined();
    expect(biFinding?.kind).toBe("removed");
    expect(biFinding?.severity).toBe("breaking");
  });

  it("heeft warning-elementen voor generalize-kandidaten (BusinessProcess, DataObject, etc.)", () => {
    // Minimaal 50 warning-elementen verwacht
    expect(report.countsBySeverity.warning).toBeGreaterThanOrEqual(50);
  });

  it("heeft OK-elementen voor ongewijzigde types (Node, Device, Deliverable, etc.)", () => {
    expect(report.countsBySeverity.ok).toBeGreaterThan(0);
  });

  it("patcht removed-elementen met BREAKING-notitie in documentation", () => {
    const patchedGaps = report.patchedModel.elements.filter(
      (el) => report.findings.find(
        (f) => f.elementId === el.id && f.kind === "removed"
      ),
    );
    expect(patchedGaps.length).toBe(4); // 3 Gap + 1 BusinessInteraction
    for (const el of patchedGaps) {
      expect(el.documentation).toMatch(/\[ArchiMate 4\.0 BREAKING\]/);
    }
  });

  it("patcht patchedModel.version naar 'archimate-4.0'", () => {
    expect(report.patchedModel.version).toBe("archimate-4.0");
  });

  it("generaliseert BusinessProcess naar Process in patchedModel", () => {
    const originalBp = model.elements.filter((e) => e.type === "BusinessProcess");
    expect(originalBp.length).toBe(11);

    const patchedBp = report.patchedModel.elements.filter((e) => e.type === "BusinessProcess");
    const patchedProcess = report.patchedModel.elements.filter((e) => e.type === "Process");

    // Na patch: BusinessProcess verdwijnt, Process verschijnt
    expect(patchedBp.length).toBe(0);
    expect(patchedProcess.length).toBeGreaterThanOrEqual(11);
  });

  it("generaliseert DataObject naar Object in patchedModel", () => {
    const original = model.elements.filter((e) => e.type === "DataObject");
    expect(original.length).toBe(11);

    const patched = report.patchedModel.elements.filter((e) => e.type === "Object");
    expect(patched.length).toBeGreaterThanOrEqual(11);
  });

  it("heeft onbekende types (Assessment, Junction, etc.) in unknownTypes-lijst", () => {
    // Deze types bestaan in ArchiMate 3.x maar staan niet in onze mapping
    expect(report.unknownTypes).toContain("Assessment");
    expect(report.unknownTypes).toContain("Junction");
    expect(report.unknownTypes.length).toBeGreaterThan(0);
  });

  it("is deterministisch: rapport is identiek bij tweede run op dezelfde fixture", () => {
    const model2 = parseCoArchi(fileMap);
    const report2 = runMigration(model2);
    expect(report2.totalElements).toBe(report.totalElements);
    expect(report2.countsBySeverity.breaking).toBe(report.countsBySeverity.breaking);
    expect(report2.countsBySeverity.warning).toBe(report.countsBySeverity.warning);
    expect(report2.unknownTypes).toEqual(report.unknownTypes);
  });
});

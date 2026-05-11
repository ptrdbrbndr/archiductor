/**
 * CoArchi-format serializer — produceert een folder-tree van XML-files
 * uit een ArchiModel, in Archi's interne `.archimate` XML-dialect.
 *
 * Spiegel van `parseCoArchi`: import → ArchiModel → wijzigen → export →
 * folder-tree die als batch via Gitea contents-API gepushed kan worden
 * (M6-a). Round-trip-symmetrie wordt getest in serialize-coarchi.test.ts.
 *
 * **Folder-layout** (matched op M5-a parser):
 *
 *   model.xml                                  — manifest met name + id
 *   <layer>/<elementId>.xml                    — één file per element, layer
 *                                                bepaalt directory (business,
 *                                                application, technology, …)
 *   relations/<relationshipId>.xml             — alle relationships
 *   diagrams/<viewId>.xml                      — views (ArchimateDiagramModel
 *                                                met child + sourceConnection)
 *
 * **Belangrijke verschillen met OEF**:
 *   - geen `<organization>`-blokken; folder = laag-naam
 *   - elementen leven in eigen file met archimate: root, geen `<elements>`
 *     container
 *   - relationships gebruiken `XRelationship`-suffix (CompositionRelationship,
 *     AssignmentRelationship, etc.), niet OEF's `xsi:type="Composition"`.
 *
 * Geen XML-bouwlib voor minimale dep — handmatige string-build met escape
 * helper. fast-xml-parser-XMLBuilder werkt ook maar geeft sub-optimale
 * attribute-ordering voor diff-leesbaarheid.
 */

import type {
  ArchiElement,
  ArchiLayer,
  ArchiModel,
  ArchiRelationship,
  ArchiView,
} from "../types.js";
import type { CoArchiFileMap } from "./coarchi.js";

const ARCHIMATE_NS = "http://www.archimatetool.com/archimate";

const LAYER_DIR: Record<ArchiLayer, string> = {
  business: "business",
  application: "application",
  technology: "technology",
  motivation: "motivation",
  strategy: "strategy",
  physical: "physical",
  implementation: "implementation_migration",
};

export function serializeCoArchi(model: ArchiModel): CoArchiFileMap {
  const out: CoArchiFileMap = {};

  out["model.xml"] = renderModelManifest(model);

  for (const element of model.elements) {
    const dir = LAYER_DIR[element.layer] ?? "other";
    const path = `${dir}/${safeFilename(element.id)}.xml`;
    out[path] = renderElement(element);
  }

  for (const rel of model.relationships) {
    out[`relations/${safeFilename(rel.id)}.xml`] = renderRelationship(rel);
  }

  for (const view of model.views) {
    out[`diagrams/${safeFilename(view.id)}.xml`] = renderView(view);
  }

  return out;
}

function renderModelManifest(model: ArchiModel): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<archimate:model xmlns:archimate="${ARCHIMATE_NS}" id="${escapeAttr("model-root")}" name="${escapeAttr(model.name)}"/>`,
    "",
  ].join("\n");
}

function renderElement(el: ArchiElement): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  const openTag = `<archimate:${el.type} xmlns:archimate="${ARCHIMATE_NS}" id="${escapeAttr(el.id)}" name="${escapeAttr(el.name)}">`;
  lines.push(openTag);
  if (el.documentation) {
    lines.push(`  <documentation>${escapeText(el.documentation)}</documentation>`);
  }
  if (el.properties) {
    for (const [k, v] of Object.entries(el.properties)) {
      lines.push(
        `  <property key="${escapeAttr(k)}" value="${escapeAttr(v)}"/>`,
      );
    }
  }
  lines.push(`</archimate:${el.type}>`);
  lines.push("");
  return lines.join("\n");
}

function renderRelationship(rel: ArchiRelationship): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  const nameAttr = rel.name ? ` name="${escapeAttr(rel.name)}"` : "";
  const tag = `${rel.type}Relationship`;
  lines.push(
    `<archimate:${tag} xmlns:archimate="${ARCHIMATE_NS}" id="${escapeAttr(rel.id)}" source="${escapeAttr(rel.source)}" target="${escapeAttr(rel.target)}"${nameAttr}>`,
  );
  if (rel.documentation) {
    lines.push(`  <documentation>${escapeText(rel.documentation)}</documentation>`);
  }
  lines.push(`</archimate:${tag}>`);
  lines.push("");
  return lines.join("\n");
}

function renderView(view: ArchiView): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    `<archimate:ArchimateDiagramModel xmlns:archimate="${ARCHIMATE_NS}" id="${escapeAttr(view.id)}" name="${escapeAttr(view.name)}">`,
  );
  for (const node of view.nodes) {
    lines.push(
      `  <child id="${escapeAttr(node.id)}" archimateElement="${escapeAttr(node.elementRef)}" x="${Math.round(node.x)}" y="${Math.round(node.y)}" width="${Math.round(node.width)}" height="${Math.round(node.height)}"/>`,
    );
  }
  for (const conn of view.connections) {
    lines.push(
      `  <sourceConnection id="${escapeAttr(conn.id)}" source="${escapeAttr(conn.sourceNodeRef)}" target="${escapeAttr(conn.targetNodeRef)}" archimateRelationship="${escapeAttr(conn.relationshipRef)}"/>`,
    );
  }
  lines.push("</archimate:ArchimateDiagramModel>");
  lines.push("");
  return lines.join("\n");
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function safeFilename(id: string): string {
  // Vervang elke char die niet veilig is in een filename met `_`.
  return id.replace(/[^A-Za-z0-9_.-]/g, "_");
}

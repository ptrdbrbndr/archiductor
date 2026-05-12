/**
 * Serializer: ArchiMateModel → OEF XML (ArchiMate Open Exchange Format 3.x)
 */

import type { ArchiMateModel, ArchiMateProperty } from "../model/types.js";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderProperties(properties?: ArchiMateProperty[]): string {
  if (!properties || properties.length === 0) return "";
  const props = properties
    .map(
      (p) =>
        `      <property key="${escapeXml(p.key)}" value="${escapeXml(p.value)}"/>`,
    )
    .join("\n");
  return `    <properties>\n${props}\n    </properties>\n`;
}

export function serializeOef(model: ArchiMateModel): string {
  const lines: string[] = [];

  lines.push(
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<model xmlns="http://www.opengroup.org/xsd/archimate/3.0/"`,
    `       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`,
    `       xsi:schemaLocation="http://www.opengroup.org/xsd/archimate/3.0/ http://www.opengroup.org/xsd/archimate/3.1/archimate3_Diagram.xsd"`,
    `       identifier="${escapeXml(model.id)}">`,
    `  <name>${escapeXml(model.name)}</name>`,
  );

  if (model.documentation) {
    lines.push(`  <documentation>${escapeXml(model.documentation)}</documentation>`);
  }

  // Elements
  lines.push(`  <elements>`);
  for (const el of model.elements.values()) {
    lines.push(`    <element identifier="${escapeXml(el.id)}" xsi:type="${escapeXml(el.type)}">`);
    lines.push(`      <name>${escapeXml(el.name)}</name>`);
    if (el.documentation) {
      lines.push(`      <documentation>${escapeXml(el.documentation)}</documentation>`);
    }
    if (el.properties?.length) {
      lines.push(`      <properties>`);
      for (const p of el.properties) {
        lines.push(`        <property key="${escapeXml(p.key)}" value="${escapeXml(p.value)}"/>`);
      }
      lines.push(`      </properties>`);
    }
    lines.push(`    </element>`);
  }
  lines.push(`  </elements>`);

  // Relationships
  lines.push(`  <relationships>`);
  for (const rel of model.relations.values()) {
    const nameAttr = rel.name ? ` name="${escapeXml(rel.name)}"` : "";
    lines.push(
      `    <relationship identifier="${escapeXml(rel.id)}" xsi:type="${escapeXml(rel.type)}"${nameAttr} source="${escapeXml(rel.sourceId)}" target="${escapeXml(rel.targetId)}">`,
    );
    if (rel.documentation) {
      lines.push(`      <documentation>${escapeXml(rel.documentation)}</documentation>`);
    }
    if (rel.properties?.length) {
      lines.push(`      <properties>`);
      for (const p of rel.properties) {
        lines.push(`        <property key="${escapeXml(p.key)}" value="${escapeXml(p.value)}"/>`);
      }
      lines.push(`      </properties>`);
    }
    lines.push(`    </relationship>`);
  }
  lines.push(`  </relationships>`);

  // Views
  lines.push(`  <views>`);
  lines.push(`    <diagrams>`);
  for (const view of model.views.values()) {
    const vpAttr = view.viewpoint ? ` viewpointType="${escapeXml(view.viewpoint)}"` : "";
    lines.push(`      <view identifier="${escapeXml(view.id)}"${vpAttr}>`);
    lines.push(`        <name>${escapeXml(view.name)}</name>`);
    for (const elem of view.elements) {
      lines.push(`        <node elementRef="${escapeXml(elem.elementId)}"/>`);
    }
    for (const relId of view.relations) {
      lines.push(`        <connection relationshipRef="${escapeXml(relId)}"/>`);
    }
    lines.push(`      </view>`);
  }
  lines.push(`    </diagrams>`);
  lines.push(`  </views>`);

  lines.push(`</model>`);

  return lines.join("\n");
}

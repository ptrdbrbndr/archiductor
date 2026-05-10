/**
 * <PropertiesPane> — read-only properties-panel rechts van canvas.
 *
 * Toont de gegevens van het op dit moment geselecteerde element of relatie
 * uit een ArchiModel: naam, type, laag, documentation, en (indien aanwezig)
 * custom properties. Bij geen selectie: empty-state met instructie.
 *
 * Werkt symmetrisch met <ModelExplorer> — beide hebben dezelfde
 * selectedElementId-prop. Een consumer (Dashboard) bindt de twee samen via
 * gedeelde React state.
 *
 * Toegankelijkheid:
 *  - <aside> met role + aria-label
 *  - Lijst van eigenschappen als <dl> (definition list)
 *  - aria-live polite zodat een screen-reader bij selectie-wisseling de
 *    nieuwe inhoud aankondigt
 */

import type { CSSProperties } from "react";

import type { ArchiLayer, ArchiModel, ArchiRelationship } from "archimate-js";

const LAYER_LABELS: Record<ArchiLayer, string> = {
  motivation: "Motivation",
  strategy: "Strategy",
  business: "Business",
  application: "Application",
  technology: "Technology",
  physical: "Physical",
  implementation: "Implementation",
};

export interface PropertiesPaneProps {
  model: ArchiModel | null;
  selectedElementId?: string;
  selectedRelationshipId?: string;
}

export function PropertiesPane({
  model,
  selectedElementId,
  selectedRelationshipId,
}: PropertiesPaneProps) {
  const element =
    model && selectedElementId
      ? model.elements.find((e) => e.id === selectedElementId)
      : undefined;
  const relationship =
    model && selectedRelationshipId
      ? model.relationships.find((r) => r.id === selectedRelationshipId)
      : undefined;

  const baseStyle: CSSProperties = {
    padding: "0.75rem",
    fontFamily: "system-ui, sans-serif",
    fontSize: "0.875rem",
    height: "100%",
    overflowY: "auto",
    boxSizing: "border-box",
  };

  if (!element && !relationship) {
    return (
      <aside
        data-testid="properties-pane-empty"
        role="complementary"
        aria-label="Eigenschappen (geen selectie)"
        style={{ ...baseStyle, color: "#666" }}
      >
        Selecteer een element in de boom of op het canvas om eigenschappen te
        zien.
      </aside>
    );
  }

  return (
    <aside
      data-testid="properties-pane"
      role="complementary"
      aria-label="Eigenschappen van selectie"
      aria-live="polite"
      style={baseStyle}
    >
      {element && <ElementProperties element={element} />}
      {relationship && model && (
        <RelationshipProperties relationship={relationship} model={model} />
      )}
    </aside>
  );
}

function ElementProperties({
  element,
}: {
  element: ArchiModel["elements"][number];
}) {
  return (
    <section data-testid="properties-pane-element">
      <h2
        data-testid="properties-pane-name"
        style={{ fontSize: "1rem", margin: "0 0 0.5rem" }}
      >
        {element.name}
      </h2>
      <dl style={dlStyle}>
        <PropertyRow
          label="ArchiMate-type"
          value={element.type}
          testid="properties-pane-type"
        />
        <PropertyRow
          label="Laag"
          value={LAYER_LABELS[element.layer]}
          testid="properties-pane-layer"
        />
        <PropertyRow
          label="ID"
          value={element.id}
          testid="properties-pane-id"
          mono
        />
        {element.documentation && (
          <PropertyRow
            label="Documentation"
            value={element.documentation}
            testid="properties-pane-documentation"
          />
        )}
      </dl>
      {element.properties && Object.keys(element.properties).length > 0 && (
        <section style={{ marginTop: "0.75rem" }}>
          <h3 style={{ fontSize: "0.85rem", margin: "0 0 0.25rem" }}>
            Custom properties
          </h3>
          <dl style={dlStyle}>
            {Object.entries(element.properties).map(([k, v]) => (
              <PropertyRow
                key={k}
                label={k}
                value={v}
                testid={`properties-pane-custom-${k}`}
              />
            ))}
          </dl>
        </section>
      )}
    </section>
  );
}

function RelationshipProperties({
  relationship,
  model,
}: {
  relationship: ArchiRelationship;
  model: ArchiModel;
}) {
  const source = model.elements.find((e) => e.id === relationship.source);
  const target = model.elements.find((e) => e.id === relationship.target);
  return (
    <section data-testid="properties-pane-relationship">
      <h2
        data-testid="properties-pane-name"
        style={{ fontSize: "1rem", margin: "0 0 0.5rem" }}
      >
        {relationship.name ?? `${relationship.type} relatie`}
      </h2>
      <dl style={dlStyle}>
        <PropertyRow
          label="Type"
          value={relationship.type}
          testid="properties-pane-type"
        />
        <PropertyRow
          label="Bron"
          value={source?.name ?? relationship.source}
          testid="properties-pane-source"
        />
        <PropertyRow
          label="Doel"
          value={target?.name ?? relationship.target}
          testid="properties-pane-target"
        />
        {relationship.documentation && (
          <PropertyRow
            label="Documentation"
            value={relationship.documentation}
            testid="properties-pane-documentation"
          />
        )}
      </dl>
    </section>
  );
}

const dlStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "max-content 1fr",
  columnGap: "0.5rem",
  rowGap: "0.25rem",
  margin: 0,
};

function PropertyRow({
  label,
  value,
  testid,
  mono,
}: {
  label: string;
  value: string;
  testid: string;
  mono?: boolean;
}) {
  return (
    <>
      <dt style={{ color: "#666", fontWeight: 500 }}>{label}</dt>
      <dd
        data-testid={testid}
        style={{
          margin: 0,
          fontFamily: mono ? "ui-monospace, monospace" : "inherit",
          fontSize: mono ? "0.8rem" : "inherit",
          color: "#222",
          wordBreak: "break-word",
        }}
      >
        {value}
      </dd>
    </>
  );
}

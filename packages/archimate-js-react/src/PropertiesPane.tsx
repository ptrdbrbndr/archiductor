/**
 * <PropertiesPane> — properties-panel rechts van canvas.
 *
 * Twee modi:
 *  - **read-only** (default, `editable=false`): toont de gegevens van het op
 *    dit moment geselecteerde element of relatie uit een ArchiModel.
 *  - **editable** (`editable=true`, M4-b): inputs voor naam + documentation +
 *    "Verwijderen" knop. Consumers dispatchen via `onUpdateElement` /
 *    `onUpdateRelationship` / `onDeleteElement` / `onDeleteRelationship`.
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
 *  - Inputs hebben labels via <label htmlFor>
 */

import { useEffect, useState, type CSSProperties } from "react";

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

export interface ElementPatch {
  name?: string;
  documentation?: string;
}

export interface RelationshipPatch {
  name?: string;
  documentation?: string;
}

export interface PropertiesPaneProps {
  model: ArchiModel | null;
  selectedElementId?: string;
  selectedRelationshipId?: string;
  /** Edit-mode activeren. Standaard `false` (read-only). */
  editable?: boolean;
  onUpdateElement?: (id: string, patch: ElementPatch) => void;
  onUpdateRelationship?: (id: string, patch: RelationshipPatch) => void;
  /** Cascade-confirmation is verantwoordelijkheid van de consumer. */
  onDeleteElement?: (id: string) => void;
  onDeleteRelationship?: (id: string) => void;
}

export function PropertiesPane({
  model,
  selectedElementId,
  selectedRelationshipId,
  editable = false,
  onUpdateElement,
  onUpdateRelationship,
  onDeleteElement,
  onDeleteRelationship,
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
        style={{ ...baseStyle, opacity: 0.6 }}
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
      {element && (
        <ElementProperties
          element={element}
          editable={editable}
          onUpdate={onUpdateElement}
          onDelete={onDeleteElement}
        />
      )}
      {relationship && model && (
        <RelationshipProperties
          relationship={relationship}
          model={model}
          editable={editable}
          onUpdate={onUpdateRelationship}
          onDelete={onDeleteRelationship}
        />
      )}
    </aside>
  );
}

function ElementProperties({
  element,
  editable,
  onUpdate,
  onDelete,
}: {
  element: ArchiModel["elements"][number];
  editable: boolean;
  onUpdate?: (id: string, patch: ElementPatch) => void;
  onDelete?: (id: string) => void;
}) {
  if (editable && onUpdate) {
    return (
      <EditableElementSection
        element={element}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />
    );
  }

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

function EditableElementSection({
  element,
  onUpdate,
  onDelete,
}: {
  element: ArchiModel["elements"][number];
  onUpdate: (id: string, patch: ElementPatch) => void;
  onDelete?: (id: string) => void;
}) {
  // Lokale state om typen niet voor elke keystroke door de modeling-service
  // te jagen. On-blur (en debounce-vrij submit) commit het naar de canvas.
  const [name, setName] = useState(element.name);
  const [documentation, setDocumentation] = useState(element.documentation ?? "");

  // Sync wanneer een ander element wordt geselecteerd of externe wijziging
  // landt (bv. via canvas-edit door iemand anders).
  useEffect(() => {
    setName(element.name);
    setDocumentation(element.documentation ?? "");
  }, [element.id, element.name, element.documentation]);

  const commitName = () => {
    if (name.trim() !== element.name) {
      onUpdate(element.id, { name: name.trim() || element.name });
    }
  };
  const commitDocumentation = () => {
    const next = documentation.trim() || undefined;
    if (next !== element.documentation) {
      onUpdate(element.id, { documentation: next });
    }
  };

  return (
    <section data-testid="properties-pane-element-editable">
      <div style={{ marginBottom: "0.75rem" }}>
        <label
          htmlFor={`pp-name-${element.id}`}
          style={labelStyle}
        >
          Naam
        </label>
        <input
          id={`pp-name-${element.id}`}
          data-testid="properties-pane-name-input"
          type="text"
          value={name}
          maxLength={400}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
          style={inputStyle}
        />
      </div>
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
      </dl>
      <div style={{ marginTop: "0.75rem" }}>
        <label
          htmlFor={`pp-doc-${element.id}`}
          style={labelStyle}
        >
          Documentation
        </label>
        <textarea
          id={`pp-doc-${element.id}`}
          data-testid="properties-pane-documentation-input"
          value={documentation}
          rows={4}
          maxLength={4000}
          onChange={(e) => setDocumentation(e.target.value)}
          onBlur={commitDocumentation}
          style={{ ...inputStyle, resize: "vertical", minHeight: "4rem" }}
        />
      </div>
      {onDelete && (
        <div style={{ marginTop: "1rem" }}>
          <button
            type="button"
            data-testid="properties-pane-delete-element"
            onClick={() => onDelete(element.id)}
            style={dangerButtonStyle}
            aria-label={`Verwijder element ${element.name}`}
          >
            Verwijderen
          </button>
        </div>
      )}
    </section>
  );
}

function RelationshipProperties({
  relationship,
  model,
  editable,
  onUpdate,
  onDelete,
}: {
  relationship: ArchiRelationship;
  model: ArchiModel;
  editable: boolean;
  onUpdate?: (id: string, patch: RelationshipPatch) => void;
  onDelete?: (id: string) => void;
}) {
  const source = model.elements.find((e) => e.id === relationship.source);
  const target = model.elements.find((e) => e.id === relationship.target);

  if (editable && onUpdate) {
    return (
      <EditableRelationshipSection
        relationship={relationship}
        sourceName={source?.name ?? relationship.source}
        targetName={target?.name ?? relationship.target}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />
    );
  }

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

function EditableRelationshipSection({
  relationship,
  sourceName,
  targetName,
  onUpdate,
  onDelete,
}: {
  relationship: ArchiRelationship;
  sourceName: string;
  targetName: string;
  onUpdate: (id: string, patch: RelationshipPatch) => void;
  onDelete?: (id: string) => void;
}) {
  const [name, setName] = useState(relationship.name ?? "");

  useEffect(() => {
    setName(relationship.name ?? "");
  }, [relationship.id, relationship.name]);

  const commitName = () => {
    const next = name.trim() || undefined;
    if (next !== relationship.name) {
      onUpdate(relationship.id, { name: next });
    }
  };

  return (
    <section data-testid="properties-pane-relationship-editable">
      <div style={{ marginBottom: "0.75rem" }}>
        <label
          htmlFor={`pp-rel-name-${relationship.id}`}
          style={labelStyle}
        >
          Naam (optioneel)
        </label>
        <input
          id={`pp-rel-name-${relationship.id}`}
          data-testid="properties-pane-rel-name-input"
          type="text"
          value={name}
          maxLength={400}
          placeholder={`${relationship.type} relatie`}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
          style={inputStyle}
        />
      </div>
      <dl style={dlStyle}>
        <PropertyRow
          label="Type"
          value={relationship.type}
          testid="properties-pane-type"
        />
        <PropertyRow
          label="Bron"
          value={sourceName}
          testid="properties-pane-source"
        />
        <PropertyRow
          label="Doel"
          value={targetName}
          testid="properties-pane-target"
        />
      </dl>
      {onDelete && (
        <div style={{ marginTop: "1rem" }}>
          <button
            type="button"
            data-testid="properties-pane-delete-relationship"
            onClick={() => onDelete(relationship.id)}
            style={dangerButtonStyle}
            aria-label="Verwijder relatie"
          >
            Verwijderen
          </button>
        </div>
      )}
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

const labelStyle: CSSProperties = {
  display: "block",
  opacity: 0.65,
  fontWeight: 500,
  marginBottom: "0.25rem",
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "0.375rem 0.5rem",
  border: "1px solid currentColor",
  borderRadius: "4px",
  background: "transparent",
  color: "inherit",
  fontSize: "0.875rem",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const dangerButtonStyle: CSSProperties = {
  padding: "0.4rem 0.75rem",
  border: "1px solid currentColor",
  borderRadius: "4px",
  background: "transparent",
  color: "#dc2626",
  fontSize: "0.875rem",
  fontWeight: 600,
  cursor: "pointer",
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
      <dt style={{ opacity: 0.65, fontWeight: 500 }}>{label}</dt>
      <dd
        data-testid={testid}
        style={{
          margin: 0,
          fontFamily: mono ? "ui-monospace, monospace" : "inherit",
          fontSize: mono ? "0.8rem" : "inherit",
          color: "inherit",
          wordBreak: "break-word",
        }}
      >
        {value}
      </dd>
    </>
  );
}

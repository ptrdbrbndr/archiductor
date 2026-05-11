/**
 * <ModelExplorer> — tree-view voor een ArchiMate ArchiModel.
 *
 * Toont per laag een uitklapbare lijst van elementen. Bij click op een element
 * roept `onSelectElement(id)` aan; `selectedElementId` controleert visual
 * highlighting. Werkt los van de Viewer / canvas — consumer koppelt selectie-
 * state.
 *
 * Lagen worden in vaste ArchiMate-volgorde getoond (Motivation → Strategy →
 * Business → Application → Technology → Physical → Implementation) zodat het
 * tree-overzicht consistent is over modellen heen.
 *
 * Toegankelijkheid:
 *  - <details>/<summary> geven native keyboard-navigatie (Tab + Enter)
 *  - aria-label per element met laag-context + type
 *  - aria-current="true" op het geselecteerde element
 */

import type { ArchiLayer, ArchiModel } from "archimate-js";

const LAYER_ORDER: ArchiLayer[] = [
  "motivation",
  "strategy",
  "business",
  "application",
  "technology",
  "physical",
  "implementation",
];

const LAYER_LABELS: Record<ArchiLayer, string> = {
  motivation: "Motivation",
  strategy: "Strategy",
  business: "Business",
  application: "Application",
  technology: "Technology",
  physical: "Physical",
  implementation: "Implementation",
};

const LAYER_DOT_COLORS: Record<ArchiLayer, string> = {
  business: "#FFFFCC",
  application: "#CCFFFF",
  technology: "#CCFFCC",
  motivation: "#E5CCFF",
  strategy: "#F4CCCC",
  physical: "#FFE5CC",
  implementation: "#FFD9F0",
};

export interface ModelExplorerProps {
  model: ArchiModel | null;
  selectedElementId?: string;
  onSelectElement?: (elementId: string) => void;
}

export function ModelExplorer({
  model,
  selectedElementId,
  onSelectElement,
}: ModelExplorerProps) {
  if (!model) {
    return (
      <div
        data-testid="model-explorer-empty"
        role="region"
        aria-label="Model explorer (geen model geladen)"
        style={{
          padding: "0.75rem",
          opacity: 0.65,
          fontSize: "0.875rem",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        Geen model geladen — upload een ArchiMate-bestand of selecteer een
        model uit het dashboard.
      </div>
    );
  }

  const elementsByLayer = new Map<ArchiLayer, ArchiModel["elements"]>();
  for (const layer of LAYER_ORDER) elementsByLayer.set(layer, []);
  for (const element of model.elements) {
    const list = elementsByLayer.get(element.layer);
    if (list) list.push(element);
  }

  const totalElements = model.elements.length;
  const totalRelationships = model.relationships.length;

  return (
    <nav
      data-testid="model-explorer"
      aria-label={`Model explorer voor ${model.name}`}
      style={{
        padding: "0.75rem",
        fontFamily: "system-ui, sans-serif",
        fontSize: "0.875rem",
        height: "100%",
        overflowY: "auto",
        boxSizing: "border-box",
      }}
    >
      <header style={{ marginBottom: "0.75rem" }}>
        <strong data-testid="model-explorer-model-name">{model.name}</strong>
        <div style={{ opacity: 0.65, fontSize: "0.75rem" }}>
          {totalElements} {totalElements === 1 ? "element" : "elementen"} ·{" "}
          {totalRelationships}{" "}
          {totalRelationships === 1 ? "relatie" : "relaties"} ·{" "}
          {model.views.length} view{model.views.length === 1 ? "" : "s"}
        </div>
      </header>

      {LAYER_ORDER.map((layer) => {
        const elements = elementsByLayer.get(layer) ?? [];
        if (elements.length === 0) return null;
        const dot = LAYER_DOT_COLORS[layer];

        return (
          <details
            key={layer}
            open
            data-testid={`model-explorer-layer-${layer}`}
            style={{ marginBottom: "0.5rem" }}
          >
            <summary
              style={{
                cursor: "pointer",
                fontWeight: 600,
                padding: "0.25rem 0",
                userSelect: "none",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: dot,
                  border: "1px solid currentColor",
                  marginRight: "0.5rem",
                  verticalAlign: "middle",
                }}
              />
              {LAYER_LABELS[layer]}{" "}
              <span
                style={{
                  opacity: 0.6,
                  fontWeight: 400,
                  fontSize: "0.75rem",
                }}
              >
                ({elements.length})
              </span>
            </summary>
            <ul
              style={{
                listStyle: "none",
                margin: "0.25rem 0 0",
                padding: "0 0 0 1.25rem",
              }}
            >
              {elements.map((element) => {
                const isSelected = element.id === selectedElementId;
                return (
                  <li key={element.id} style={{ margin: "0.1rem 0" }}>
                    <button
                      type="button"
                      data-testid={`model-explorer-element-${element.id}`}
                      onClick={() => onSelectElement?.(element.id)}
                      aria-label={`${element.name} — ${element.type} in ${LAYER_LABELS[layer]} laag`}
                      aria-current={isSelected ? "true" : undefined}
                      style={{
                        background: isSelected
                          ? "color-mix(in srgb, currentColor 12%, transparent)"
                          : "transparent",
                        border: "none",
                        cursor: "pointer",
                        padding: "0.2rem 0.4rem",
                        textAlign: "left",
                        width: "100%",
                        borderRadius: 3,
                        fontFamily: "inherit",
                        fontSize: "inherit",
                        color: "inherit",
                      }}
                    >
                      {element.name}{" "}
                      <span style={{ opacity: 0.6, fontSize: "0.75rem" }}>
                        {element.type}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </nav>
  );
}

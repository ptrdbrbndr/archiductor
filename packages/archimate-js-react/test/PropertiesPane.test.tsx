/**
 * @vitest-environment happy-dom
 *
 * Tests voor <PropertiesPane> component.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { ArchiModel } from "archimate-js";

import { PropertiesPane } from "../src/PropertiesPane.js";

afterEach(cleanup);

function makeModel(): ArchiModel {
  return {
    version: "archimate-4.0",
    name: "Test",
    elements: [
      {
        id: "biz-1",
        name: "Order verwerken",
        type: "BusinessProcess",
        layer: "business",
        documentation: "Verwerkt klant-orders volgens SLA.",
        properties: { Eigenaar: "Verkoopteam", SLA: "P1: 4 uur" },
      },
      {
        id: "biz-2",
        name: "Verkoper",
        type: "BusinessActor",
        layer: "business",
      },
    ],
    relationships: [
      {
        id: "rel-1",
        type: "Assignment",
        source: "biz-1",
        target: "biz-2",
        name: "Eigenaar van",
      },
    ],
    views: [],
  };
}

describe("<PropertiesPane>", () => {
  it("toont empty-state zonder selectie", () => {
    render(<PropertiesPane model={makeModel()} />);
    expect(screen.getByTestId("properties-pane-empty")).toBeDefined();
    expect(screen.queryByTestId("properties-pane")).toBeNull();
  });

  it("toont element-eigenschappen bij selectie", () => {
    render(
      <PropertiesPane model={makeModel()} selectedElementId="biz-1" />,
    );
    expect(screen.getByTestId("properties-pane-name").textContent).toBe(
      "Order verwerken",
    );
    expect(screen.getByTestId("properties-pane-type").textContent).toBe(
      "BusinessProcess",
    );
    expect(screen.getByTestId("properties-pane-layer").textContent).toBe(
      "Business",
    );
    expect(screen.getByTestId("properties-pane-id").textContent).toBe("biz-1");
    expect(
      screen.getByTestId("properties-pane-documentation").textContent,
    ).toBe("Verwerkt klant-orders volgens SLA.");
  });

  it("toont custom properties als ze aanwezig zijn", () => {
    render(
      <PropertiesPane model={makeModel()} selectedElementId="biz-1" />,
    );
    expect(
      screen.getByTestId("properties-pane-custom-Eigenaar").textContent,
    ).toBe("Verkoopteam");
    expect(
      screen.getByTestId("properties-pane-custom-SLA").textContent,
    ).toBe("P1: 4 uur");
  });

  it("toont geen custom-properties-sectie als element er geen heeft", () => {
    render(
      <PropertiesPane model={makeModel()} selectedElementId="biz-2" />,
    );
    expect(screen.getByTestId("properties-pane-name").textContent).toBe(
      "Verkoper",
    );
    expect(
      screen.queryByTestId("properties-pane-custom-Eigenaar"),
    ).toBeNull();
  });

  it("toont relationship-eigenschappen bij selectie van een relatie", () => {
    render(
      <PropertiesPane
        model={makeModel()}
        selectedRelationshipId="rel-1"
      />,
    );
    expect(screen.getByTestId("properties-pane-name").textContent).toBe(
      "Eigenaar van",
    );
    expect(screen.getByTestId("properties-pane-type").textContent).toBe(
      "Assignment",
    );
    expect(screen.getByTestId("properties-pane-source").textContent).toBe(
      "Order verwerken",
    );
    expect(screen.getByTestId("properties-pane-target").textContent).toBe(
      "Verkoper",
    );
  });

  it("a11y: aside met role=complementary + aria-live=polite", () => {
    render(
      <PropertiesPane model={makeModel()} selectedElementId="biz-1" />,
    );
    const pane = screen.getByTestId("properties-pane");
    expect(pane.tagName).toBe("ASIDE");
    expect(pane.getAttribute("role")).toBe("complementary");
    expect(pane.getAttribute("aria-live")).toBe("polite");
    expect(pane.getAttribute("aria-label")).toBe(
      "Eigenschappen van selectie",
    );
  });
});

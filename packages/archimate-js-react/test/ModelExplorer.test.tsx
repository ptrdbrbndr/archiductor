/**
 * @vitest-environment happy-dom
 *
 * Tests voor <ModelExplorer> component.
 *
 * Verifieert:
 *  - Lege state toont placeholder met testid
 *  - Geladen model toont per-laag groupeering met juiste counts
 *  - Element-button click roept onSelectElement met juiste ID
 *  - Geselecteerd element krijgt aria-current="true"
 *  - A11y: nav role, aria-label per element met layer-context
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ArchiModel } from "archimate-js";

import { ModelExplorer } from "../src/ModelExplorer.js";

afterEach(cleanup);

function makeModel(): ArchiModel {
  return {
    version: "archimate-4.0",
    name: "Test Model",
    elements: [
      {
        id: "biz-1",
        name: "Order verwerken",
        type: "BusinessProcess",
        layer: "business",
      },
      {
        id: "biz-2",
        name: "Verkoper",
        type: "BusinessActor",
        layer: "business",
      },
      {
        id: "app-1",
        name: "OrderSystem",
        type: "ApplicationComponent",
        layer: "application",
      },
      {
        id: "tech-1",
        name: "Server-01",
        type: "Node",
        layer: "technology",
      },
    ],
    relationships: [
      {
        id: "rel-1",
        type: "Assignment",
        source: "biz-1",
        target: "biz-2",
      },
    ],
    views: [
      {
        id: "view-1",
        name: "Main",
        nodes: [],
        connections: [],
      },
    ],
  };
}

describe("<ModelExplorer>", () => {
  it("toont placeholder als model null is", () => {
    render(<ModelExplorer model={null} />);
    expect(screen.getByTestId("model-explorer-empty")).toBeDefined();
    expect(screen.queryByTestId("model-explorer")).toBeNull();
  });

  it("toont model-naam + totale element/relatie/view counts", () => {
    render(<ModelExplorer model={makeModel()} />);
    expect(screen.getByTestId("model-explorer-model-name").textContent).toBe(
      "Test Model",
    );
    const explorer = screen.getByTestId("model-explorer");
    expect(explorer.textContent).toContain("4 elementen");
    expect(explorer.textContent).toContain("1 relatie");
    expect(explorer.textContent).toContain("1 view");
  });

  it("groepeert elementen per laag", () => {
    render(<ModelExplorer model={makeModel()} />);
    expect(screen.getByTestId("model-explorer-layer-business")).toBeDefined();
    expect(
      screen.getByTestId("model-explorer-layer-application"),
    ).toBeDefined();
    expect(screen.getByTestId("model-explorer-layer-technology")).toBeDefined();
    // Motivation/Strategy/Physical/Implementation worden niet getoond zonder elementen.
    expect(
      screen.queryByTestId("model-explorer-layer-motivation"),
    ).toBeNull();
  });

  it("klik op element-button roept onSelectElement met de juiste ID", () => {
    const onSelect = vi.fn();
    render(<ModelExplorer model={makeModel()} onSelectElement={onSelect} />);
    const button = screen.getByTestId("model-explorer-element-biz-1");
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("biz-1");
  });

  it("geselecteerd element krijgt aria-current=true", () => {
    render(
      <ModelExplorer model={makeModel()} selectedElementId="app-1" />,
    );
    const selectedBtn = screen.getByTestId("model-explorer-element-app-1");
    expect(selectedBtn.getAttribute("aria-current")).toBe("true");
    const otherBtn = screen.getByTestId("model-explorer-element-biz-1");
    expect(otherBtn.getAttribute("aria-current")).toBeNull();
  });

  it("elke element-button heeft aria-label met type + laag-context", () => {
    render(<ModelExplorer model={makeModel()} />);
    const button = screen.getByTestId("model-explorer-element-biz-1");
    expect(button.getAttribute("aria-label")).toBe(
      "Order verwerken — BusinessProcess in Business laag",
    );
  });

  it("nav-region heeft aria-label met model-naam", () => {
    render(<ModelExplorer model={makeModel()} />);
    const nav = screen.getByTestId("model-explorer");
    expect(nav.getAttribute("aria-label")).toBe(
      "Model explorer voor Test Model",
    );
    expect(nav.tagName).toBe("NAV");
  });
});

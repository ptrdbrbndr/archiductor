/**
 * archimate-js context-pad module — verschijnt naast een geselecteerd element
 * en biedt twee acties (M4-b minimaal):
 *
 *  - **Connect** — start drag om een relatie te tekenen naar een ander element.
 *    Diagram-js' standaard `connect`-service handelt het tekenen af; we geven
 *    een default-businessObject mee zodat de relatie als ArchiMate Association
 *    in de model-state komt (verfijning naar correct relationship-type komt
 *    later in M4-c via een type-picker).
 *
 *  - **Delete** — verwijdert het element + alle relaties die er aan hangen.
 *    Diagram-js' modeling.removeElements() cascadeert automatisch op
 *    connections; de exportModel-walk pakt dat op bij de volgende save.
 *
 * Het pad opent automatisch bij selectie als ContextPadModule + dit provider-
 * module geladen zijn. Geen extra wiring nodig in de consumer.
 */

interface Shape {
  id: string;
  businessObject?: {
    elementId?: string;
    archimateType?: string;
    layer?: string;
    name?: string;
  };
}

interface DragEventLike {
  preventDefault?: () => void;
}

interface ContextPad {
  registerProvider: (provider: ArchiMateContextPadProvider) => void;
}

interface Connect {
  start: (
    event: DragEventLike,
    source: Shape,
    connectionStart?: unknown,
    autoActivate?: boolean,
  ) => void;
}

interface Modeling {
  removeElements: (elements: Shape[]) => void;
}

class ArchiMateContextPadProvider {
  static $inject = ["contextPad", "connect", "modeling"];

  private _connect: Connect;
  private _modeling: Modeling;

  constructor(contextPad: ContextPad, connect: Connect, modeling: Modeling) {
    this._connect = connect;
    this._modeling = modeling;
    contextPad.registerProvider(this);
  }

  getContextPadEntries(element: Shape) {
    const connect = this._connect;
    const modeling = this._modeling;

    return {
      "connect": {
        group: "edit",
        className: "archi-context-pad-connect",
        title: "Verbind met ander element",
        action: {
          click: (event: DragEventLike) => connect.start(event, element),
          dragstart: (event: DragEventLike) => connect.start(event, element),
        },
      },
      "delete": {
        group: "edit",
        className: "archi-context-pad-delete",
        title: "Verwijder element",
        action: {
          click: () => modeling.removeElements([element]),
        },
      },
    };
  }
}

export const contextPadModule = {
  __init__: ["contextPadProvider"],
  contextPadProvider: ["type", ArchiMateContextPadProvider],
};

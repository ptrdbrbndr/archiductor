/**
 * archimate-js modeling-extensions module — registreert custom command-
 * handlers bovenop diagram-js' standaard Modeling-service.
 *
 *  - `archimate.update.bo` — wijzigt businessObject-velden via een proper
 *    CommandHandler zodat commandStack.changed fired en undo/redo werkt.
 *
 * Gebruik:
 *
 *   import { modelingModule } from "archimate-js";
 *   new Diagram({ modules: [..., modelingModule] });
 *
 * De `Modeler` class registreert dit automatisch.
 */

import { UpdateBusinessObjectHandler } from "./UpdateBusinessObjectHandler.js";

interface CommandStack {
  registerHandler: (
    command: string,
    handlerClass: new (...args: unknown[]) => unknown,
  ) => void;
}

class ArchiMateCommandRegistrar {
  static $inject = ["commandStack"];

  constructor(commandStack: CommandStack) {
    commandStack.registerHandler(
      "archimate.update.bo",
      UpdateBusinessObjectHandler as unknown as new (
        ...args: unknown[]
      ) => unknown,
    );
  }
}

export const archimateModelingModule = {
  __init__: ["archimateCommandRegistrar"],
  archimateCommandRegistrar: ["type", ArchiMateCommandRegistrar],
};

export { UpdateBusinessObjectHandler };
export type { UpdateBusinessObjectContext } from "./UpdateBusinessObjectHandler.js";

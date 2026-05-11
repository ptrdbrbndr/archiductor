/**
 * UpdateBusinessObjectHandler — command-handler voor mutaties op een
 * element- of connection-businessObject (naam, documentation, archimateType).
 *
 * Doorloopt de standaard diagram-js command-stack, dus:
 *  - commandStack.changed-event fired → consumers' auto-save triggert
 *  - undo/redo werkt automatisch (M4-c gebruikt dit)
 *
 * Registratie: zie ./index.ts modelingModule. Aanroep vanuit consumer:
 *
 *   modeler.get<CommandStack>('commandStack').execute('archimate.update.bo', {
 *     element: shape,
 *     properties: { name: 'New' }
 *   });
 *
 * `properties` worden non-destructief gemerged met de huidige businessObject;
 * undefined waarden verwijderen het veld.
 */

interface ElementLike {
  businessObject?: Record<string, unknown>;
}

interface EventBus {
  fire: (event: string, payload: unknown) => void;
}

export interface UpdateBusinessObjectContext {
  element: ElementLike;
  properties: Record<string, unknown>;
  /** Wordt gevuld tijdens execute — voor revert(). Niet door consumer zetten. */
  oldProperties?: Record<string, unknown>;
}

export class UpdateBusinessObjectHandler {
  static $inject = ["eventBus"];

  private _eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this._eventBus = eventBus;
  }

  execute(context: UpdateBusinessObjectContext): ElementLike {
    const { element, properties } = context;
    const bo = (element.businessObject ?? {}) as Record<string, unknown>;

    // Snapshot per gewijzigd veld voor revert.
    const oldProps: Record<string, unknown> = {};
    for (const key of Object.keys(properties)) {
      oldProps[key] = bo[key];
    }
    context.oldProperties = oldProps;

    for (const [key, value] of Object.entries(properties)) {
      if (value === undefined) {
        delete bo[key];
      } else {
        bo[key] = value;
      }
    }
    element.businessObject = bo;

    this._eventBus.fire("element.changed", { element });
    return element;
  }

  revert(context: UpdateBusinessObjectContext): ElementLike {
    const { element, oldProperties } = context;
    if (!oldProperties) return element;
    const bo = (element.businessObject ?? {}) as Record<string, unknown>;

    for (const [key, value] of Object.entries(oldProperties)) {
      if (value === undefined) {
        delete bo[key];
      } else {
        bo[key] = value;
      }
    }
    element.businessObject = bo;

    this._eventBus.fire("element.changed", { element });
    return element;
  }
}

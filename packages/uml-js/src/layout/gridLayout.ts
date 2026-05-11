/**
 * gridLayout — simpel auto-layout algoritme voor class diagrams.
 *
 * Plaatst classes in een raster van MAX_PER_ROW kolommen met
 * HORIZONTAL_SPACING en VERTICAL_SPACING.
 *
 * Hoogte van elke class-shape wordt berekend op basis van het aantal
 * attributen en operaties (zodat compartimenten niet overlappen).
 */

import type { UmlClass } from "../types.js";

// ─── constants ────────────────────────────────────────────────────────────────

const CLASS_WIDTH = 160;
const HEADER_HEIGHT = 30;
const STEREOTYPE_EXTRA_HEIGHT = 18;
const ROW_HEIGHT = 20;
const EMPTY_COMPARTMENT_HEIGHT = 20;
const HORIZONTAL_SPACING = 200;
const VERTICAL_SPACING = 250;
const MAX_PER_ROW = 3;

// ─── types ────────────────────────────────────────────────────────────────────

export interface ClassLayout {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─── public API ───────────────────────────────────────────────────────────────

/**
 * Berekent layout-posities voor een lijst UmlClass-objecten.
 *
 * @param classes  De te plaatsen classes
 * @returns        Een ClassLayout per class met x/y/width/height
 */
export function computeGridLayout(classes: UmlClass[]): ClassLayout[] {
  return classes.map((cls, index) => {
    const col = index % MAX_PER_ROW;
    const row = Math.floor(index / MAX_PER_ROW);

    return {
      id: cls.id,
      x: col * (CLASS_WIDTH + HORIZONTAL_SPACING),
      y: row * VERTICAL_SPACING,
      width: CLASS_WIDTH,
      height: computeClassHeight(cls),
    };
  });
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function computeClassHeight(cls: UmlClass): number {
  const hasStereotype = !!cls.stereotype || cls.isInterface;
  const headerH = hasStereotype
    ? HEADER_HEIGHT + STEREOTYPE_EXTRA_HEIGHT
    : HEADER_HEIGHT;

  const attrH =
    cls.attributes.length > 0
      ? cls.attributes.length * ROW_HEIGHT + 4
      : EMPTY_COMPARTMENT_HEIGHT;

  const opH =
    cls.operations.length > 0
      ? cls.operations.length * ROW_HEIGHT + 4
      : EMPTY_COMPARTMENT_HEIGHT;

  return headerH + attrH + opH;
}

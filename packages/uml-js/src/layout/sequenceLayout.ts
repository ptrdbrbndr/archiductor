/**
 * sequenceLayout — layout algoritme voor sequence diagrams.
 *
 * Lifelines worden equidistant horizontaal geplaatst.
 * Messages worden op oplopende y-positie gezet (per order-waarde).
 */

import type { UmlLifeline, UmlMessage } from "../types.js";

// ─── constants ────────────────────────────────────────────────────────────────

const LIFELINE_WIDTH = 100;
const LIFELINE_GAP = 200;
const LIFELINE_HEADER_HEIGHT = 40;
const LIFELINE_TOP_Y = 20;
const MESSAGE_FIRST_Y = 100;
const MESSAGE_STEP_Y = 40;
const ACTIVATION_BOX_WIDTH = 10;
const ACTIVATION_BOX_HALF = ACTIVATION_BOX_WIDTH / 2;

// ─── types ────────────────────────────────────────────────────────────────────

export interface LifelineLayout {
  id: string;
  x: number;
  y: number;
  centerX: number;
  width: number;
  headerHeight: number;
  totalHeight: number;
}

export interface MessageLayout {
  id: string;
  fromX: number;
  toX: number;
  y: number;
  activationOffset: number;
}

export interface SequenceLayout {
  lifelines: LifelineLayout[];
  messages: MessageLayout[];
  totalHeight: number;
}

// ─── public API ───────────────────────────────────────────────────────────────

export function computeSequenceLayout(
  lifelines: UmlLifeline[],
  messages: UmlMessage[],
): SequenceLayout {
  const sorted = [...messages].sort((a, b) => a.order - b.order);
  const totalHeight = MESSAGE_FIRST_Y + sorted.length * MESSAGE_STEP_Y + MESSAGE_STEP_Y;

  const lifelineLayouts = lifelines.map((ll, index) => {
    const centerX = index * (LIFELINE_WIDTH + LIFELINE_GAP) + LIFELINE_WIDTH / 2;
    return {
      id: ll.id,
      x: index * (LIFELINE_WIDTH + LIFELINE_GAP),
      y: LIFELINE_TOP_Y,
      centerX,
      width: LIFELINE_WIDTH,
      headerHeight: LIFELINE_HEADER_HEIGHT,
      totalHeight,
    };
  });

  const centerXById = new Map(lifelineLayouts.map((l) => [l.id, l.centerX]));

  const messageLayouts = sorted.map((msg, index) => {
    const fromCX = centerXById.get(msg.from) ?? 0;
    const toCX = centerXById.get(msg.to) ?? 0;
    const y = MESSAGE_FIRST_Y + index * MESSAGE_STEP_Y;
    return {
      id: msg.id,
      fromX: fromCX + (fromCX < toCX ? ACTIVATION_BOX_HALF : -ACTIVATION_BOX_HALF),
      toX: toCX + (toCX < fromCX ? ACTIVATION_BOX_HALF : -ACTIVATION_BOX_HALF),
      y,
      activationOffset: ACTIVATION_BOX_HALF,
    };
  });

  return { lifelines: lifelineLayouts, messages: messageLayouts, totalHeight };
}

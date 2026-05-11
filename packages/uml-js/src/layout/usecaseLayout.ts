/**
 * usecaseLayout — layout algoritme voor use case diagrams.
 *
 * Actoren worden links van de system boundary geplaatst.
 * Use cases worden in een grid binnen de system boundary gezet.
 */

import type { UmlActor, UmlUseCase } from "../types.js";

// ─── constants ────────────────────────────────────────────────────────────────

const ACTOR_WIDTH = 50;
const ACTOR_HEIGHT = 80;
const ACTOR_GAP_Y = 40;
const ACTOR_LEFT_X = 20;
const BOUNDARY_LEFT_MARGIN = 100;
const BOUNDARY_TOP_Y = 20;
const BOUNDARY_PADDING = 40;
const USECASE_WIDTH = 140;
const USECASE_HEIGHT = 50;
const USECASE_GAP_X = 180;
const USECASE_GAP_Y = 90;
const USECASES_PER_ROW = 3;

// ─── types ────────────────────────────────────────────────────────────────────

export interface ActorLayout {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface UseCaseLayout {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface BoundaryLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UseCaseDiagramLayout {
  actors: ActorLayout[];
  useCases: UseCaseLayout[];
  boundary: BoundaryLayout;
}

// ─── public API ───────────────────────────────────────────────────────────────

export function computeUseCaseLayout(
  actors: UmlActor[],
  useCases: UmlUseCase[],
): UseCaseDiagramLayout {
  const actorLayouts = actors.map((actor, index) => {
    const x = ACTOR_LEFT_X;
    const y = BOUNDARY_TOP_Y + index * (ACTOR_HEIGHT + ACTOR_GAP_Y);
    return {
      id: actor.id,
      x,
      y,
      width: ACTOR_WIDTH,
      height: ACTOR_HEIGHT,
      centerX: x + ACTOR_WIDTH / 2,
      centerY: y + ACTOR_HEIGHT / 2,
    };
  });

  const boundaryX = ACTOR_LEFT_X + ACTOR_WIDTH + BOUNDARY_LEFT_MARGIN;

  const useCaseLayouts = useCases.map((uc, index) => {
    const col = index % USECASES_PER_ROW;
    const row = Math.floor(index / USECASES_PER_ROW);
    const x = boundaryX + BOUNDARY_PADDING + col * (USECASE_WIDTH + USECASE_GAP_X - USECASE_WIDTH);
    const y = BOUNDARY_TOP_Y + BOUNDARY_PADDING + row * (USECASE_HEIGHT + USECASE_GAP_Y - USECASE_HEIGHT);
    return {
      id: uc.id,
      x,
      y,
      width: USECASE_WIDTH,
      height: USECASE_HEIGHT,
      centerX: x + USECASE_WIDTH / 2,
      centerY: y + USECASE_HEIGHT / 2,
    };
  });

  const rows = Math.max(1, Math.ceil(useCases.length / USECASES_PER_ROW));
  const cols = Math.min(useCases.length, USECASES_PER_ROW);
  const boundaryWidth =
    cols * USECASE_WIDTH + (cols - 1) * (USECASE_GAP_X - USECASE_WIDTH) + BOUNDARY_PADDING * 2;
  const boundaryHeight =
    rows * USECASE_HEIGHT + (rows - 1) * (USECASE_GAP_Y - USECASE_HEIGHT) + BOUNDARY_PADDING * 2;

  const boundary: BoundaryLayout = {
    x: boundaryX,
    y: BOUNDARY_TOP_Y,
    width: Math.max(boundaryWidth, 200),
    height: Math.max(boundaryHeight, 150),
  };

  return { actors: actorLayouts, useCases: useCaseLayouts, boundary };
}

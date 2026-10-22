import type { MazeCellCenter } from './Maze';
import { selectRandomWalkableCells } from './Placement';

export interface MeleeEnemyData {
  x: number;
  y: number;
  row: number;
  column: number;
  radius: number;
  speed: number;
  health: number;
  contactCooldown: number;
}

export const MELEE_ENEMY_COUNT = 4;
export const MELEE_ENEMY_RADIUS = 18;
export const MELEE_ENEMY_SPEED = 72;
export const MELEE_ENEMY_HEALTH = 1;
export const MELEE_ENEMY_CONTACT_DAMAGE = 1;
export const MELEE_ENEMY_CONTACT_COOLDOWN = 700;

export function createInitialMeleeEnemies(
  walkableCells: readonly MazeCellCenter[],
  occupiedCells: readonly MazeCellCenter[],
): MeleeEnemyData[] {
  return selectRandomWalkableCells(
    walkableCells,
    MELEE_ENEMY_COUNT,
    occupiedCells,
  ).map((position) => ({
    x: position.x,
    y: position.y,
    row: position.row,
    column: position.column,
    radius: MELEE_ENEMY_RADIUS,
    speed: MELEE_ENEMY_SPEED,
    health: MELEE_ENEMY_HEALTH,
    contactCooldown: 0,
  }));
}
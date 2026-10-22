import type { MazeCellCenter } from './Maze';
import { selectRandomWalkableCells } from './Placement';

export interface RangedEnemyData {
  x: number;
  y: number;
  row: number;
  column: number;
  radius: number;
  health: number;
  shotCooldown: number;
}

export interface DanmakuBulletData {
  x: number;
  y: number;
  radius: number;
  velocityX: number;
  velocityY: number;
  damage: number;
}

export const RANGED_ENEMY_COUNT = 1;
export const RANGED_ENEMY_RADIUS = 20;
export const RANGED_ENEMY_HEALTH = 2;
export const RANGED_ENEMY_SHOT_INTERVAL = 1500;
export const RANGED_ENEMY_BULLET_SPEED = 105;
export const RANGED_ENEMY_BULLET_RADIUS = 8;
export const RANGED_ENEMY_BULLET_DAMAGE = 1;
export const RANGED_ENEMY_SPREAD_ANGLE = 0.18;

export function createInitialRangedEnemies(
  walkableCells: readonly MazeCellCenter[],
  occupiedCells: readonly MazeCellCenter[],
): RangedEnemyData[] {
  return selectRandomWalkableCells(
    walkableCells,
    RANGED_ENEMY_COUNT,
    occupiedCells,
  ).map((position) => ({
    x: position.x,
    y: position.y,
    row: position.row,
    column: position.column,
    radius: RANGED_ENEMY_RADIUS,
    health: RANGED_ENEMY_HEALTH,
    shotCooldown: 900,
  }));
}

export function createDanmakuBurst(
  enemy: RangedEnemyData,
  targetX: number,
  targetY: number,
): DanmakuBulletData[] {
  const baseAngle = Math.atan2(targetY - enemy.y, targetX - enemy.x);
  return [-RANGED_ENEMY_SPREAD_ANGLE, 0, RANGED_ENEMY_SPREAD_ANGLE].map(
    (angleOffset) => {
      const angle = baseAngle + angleOffset;
      return {
        x: enemy.x,
        y: enemy.y,
        radius: RANGED_ENEMY_BULLET_RADIUS,
        velocityX: Math.cos(angle) * RANGED_ENEMY_BULLET_SPEED,
        velocityY: Math.sin(angle) * RANGED_ENEMY_BULLET_SPEED,
        damage: RANGED_ENEMY_BULLET_DAMAGE,
      };
    },
  );
}
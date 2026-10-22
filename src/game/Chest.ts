import type { MazeCellCenter } from './Maze';
import { selectRandomWalkableCells } from './Placement';

export interface ChestData {
  x: number;
  y: number;
  row: number;
  column: number;
  isCorrect: boolean;
  isOpened: boolean;
}

export const CORRECT_CHEST_COUNT = 5;

export function createInitialChests(walkableCells: readonly MazeCellCenter[]): ChestData[] {
  const positions = selectRandomWalkableCells(walkableCells, 10);
  const correctChestIndices = new Set<number>();

  while (correctChestIndices.size < CORRECT_CHEST_COUNT) {
    correctChestIndices.add(Math.floor(Math.random() * positions.length));
  }

  return positions.map((position, index) => {
    return {
      x: position.x,
      y: position.y,
      row: position.row,
      column: position.column,
      isCorrect: correctChestIndices.has(index),
      isOpened: false,
    };
  });
}
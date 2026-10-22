import type { MazeCellCenter } from './Maze';

const START_ROW = 1;
const START_COLUMN = 1;

type OccupiedCell = Pick<MazeCellCenter, 'row' | 'column'>;

function cellKey(cell: OccupiedCell): string {
  return `${cell.row},${cell.column}`;
}

function shuffle<T>(items: T[]): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

export function selectRandomWalkableCells(
  walkableCells: readonly MazeCellCenter[],
  count: number,
  occupiedCells: readonly OccupiedCell[] = [],
): MazeCellCenter[] {
  const occupiedKeys = new Set(occupiedCells.map(cellKey));
  occupiedKeys.add(`${START_ROW},${START_COLUMN}`);

  const availableCells = shuffle(
    walkableCells.filter((cell) => !occupiedKeys.has(cellKey(cell))),
  );
  if (availableCells.length < count) {
    throw new Error('Not enough walkable cells for object placement');
  }

  return availableCells.slice(0, count);
}
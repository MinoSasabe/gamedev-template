export interface MazeWall {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MazeCellCenter {
  x: number;
  y: number;
  row: number;
  column: number;
}

export interface MazePassage {
  from: MazeCellCenter;
  to: MazeCellCenter;
}

export interface MazeExitDoor {
  x: number;
  y: number;
  isVertical: boolean;
}

export interface MazeData {
  walls: MazeWall[];
  walkableCells: MazeCellCenter[];
  passages: MazePassage[];
  exitDoor: MazeExitDoor;
  start: MazeCellCenter;
  seed: number;
}

export const LAST_SEED_STORAGE_KEY = 'escape-room-last-seed';

const ROOM_X = 48;
const ROOM_Y = 112;
const ROOM_WIDTH = 1184;
const ROOM_HEIGHT = 560;
const MAZE_COLUMNS = 12;
const MAZE_ROWS = 5;
export const MAZE_CORRIDOR_WIDTH = 60;
export const MAZE_WALL_THICKNESS = 30;
export const MAZE_CELL_SPACING = MAZE_CORRIDOR_WIDTH + MAZE_WALL_THICKNESS;

function createRandom(seed: number): () => number {
  let state = BigInt(seed);
  return () => {
    state = (state + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
    let value = state;
    value = ((value ^ (value >> 30n)) * 0xbf58476d1ce4e5b9n)
      & 0xffffffffffffffffn;
    value = ((value ^ (value >> 27n)) * 0x94d049bb133111ebn)
      & 0xffffffffffffffffn;
    value ^= value >> 31n;
    return Number(value >> 11n) / 9007199254740992;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function cellCenter(row: number, column: number): MazeCellCenter {
  const mazeWidth = (MAZE_COLUMNS - 1) * MAZE_CELL_SPACING;
  const mazeHeight = (MAZE_ROWS - 1) * MAZE_CELL_SPACING;
  const firstX = ROOM_X + (ROOM_WIDTH - mazeWidth) / 2;
  const firstY = ROOM_Y + (ROOM_HEIGHT - mazeHeight) / 2;
  return {
    x: firstX + column * MAZE_CELL_SPACING,
    y: firstY + row * MAZE_CELL_SPACING,
    row,
    column,
  };
}

function passageKey(
  first: MazeCellCenter,
  second: MazeCellCenter,
): string {
  const firstKey = `${first.row},${first.column}`;
  const secondKey = `${second.row},${second.column}`;
  return firstKey < secondKey
    ? `${firstKey}|${secondKey}`
    : `${secondKey}|${firstKey}`;
}

export function createMaze(seed: number): MazeData {
  const normalizedSeed = Number.isSafeInteger(seed) && seed >= 0
    ? seed
    : createRandomSeed();
  const random = createRandom(normalizedSeed);
  const cells = Array.from({ length: MAZE_ROWS }, (_, row) =>
    Array.from({ length: MAZE_COLUMNS }, (_, column) => cellCenter(row, column)),
  );
  const visited = new Set<string>();
  const passages: MazePassage[] = [];

  const visit = (cell: MazeCellCenter): void => {
    visited.add(`${cell.row},${cell.column}`);
    const neighbors = shuffle(
      [
        cells[cell.row - 1]?.[cell.column],
        cells[cell.row + 1]?.[cell.column],
        cells[cell.row]?.[cell.column - 1],
        cells[cell.row]?.[cell.column + 1],
      ].filter((neighbor): neighbor is MazeCellCenter => neighbor !== undefined),
      random,
    );

    for (const neighbor of neighbors) {
      const key = `${neighbor.row},${neighbor.column}`;
      if (visited.has(key)) {
        continue;
      }
      passages.push({ from: cell, to: neighbor });
      visit(neighbor);
    }
  };

  const start = cells[1][1];
  visit(start);

  const passageKeys = new Set(
    passages.map(({ from, to }) => passageKey(from, to)),
  );
  const firstCell = cells[0][0];
  const lastCell = cells[MAZE_ROWS - 1][MAZE_COLUMNS - 1];
  const mazeLeft = firstCell.x - MAZE_CORRIDOR_WIDTH / 2 - MAZE_WALL_THICKNESS;
  const mazeTop = firstCell.y - MAZE_CORRIDOR_WIDTH / 2 - MAZE_WALL_THICKNESS;
  const mazeRight = lastCell.x + MAZE_CORRIDOR_WIDTH / 2;
  const mazeBottom = lastCell.y + MAZE_CORRIDOR_WIDTH / 2;
  const walls: MazeWall[] = [
    {
      x: mazeLeft,
      y: mazeTop,
      width: mazeRight - mazeLeft,
      height: MAZE_WALL_THICKNESS,
    },
    {
      x: mazeLeft,
      y: mazeBottom,
      width: mazeRight - mazeLeft,
      height: MAZE_WALL_THICKNESS,
    },
    {
      x: mazeLeft,
      y: mazeTop,
      width: MAZE_WALL_THICKNESS,
      height: mazeBottom - mazeTop + MAZE_WALL_THICKNESS,
    },
    {
      x: mazeRight,
      y: mazeTop,
      width: MAZE_WALL_THICKNESS,
      height: mazeBottom - mazeTop + MAZE_WALL_THICKNESS,
    },
  ];

  for (const row of cells) {
    for (const cell of row) {
      const right = cells[cell.row]?.[cell.column + 1];
      if (right && !passageKeys.has(passageKey(cell, right))) {
        walls.push({
          x: cell.x + MAZE_CORRIDOR_WIDTH / 2,
          y: cell.y - (MAZE_CORRIDOR_WIDTH + MAZE_WALL_THICKNESS) / 2,
          width: MAZE_WALL_THICKNESS,
          height: MAZE_CORRIDOR_WIDTH + MAZE_WALL_THICKNESS,
        });
      }

      const below = cells[cell.row + 1]?.[cell.column];
      if (below && !passageKeys.has(passageKey(cell, below))) {
        walls.push({
          x: cell.x - (MAZE_CORRIDOR_WIDTH + MAZE_WALL_THICKNESS) / 2,
          y: cell.y + MAZE_CORRIDOR_WIDTH / 2,
          width: MAZE_CORRIDOR_WIDTH + MAZE_WALL_THICKNESS,
          height: MAZE_WALL_THICKNESS,
        });
      }
    }
  }

  const exitWallIndex = Math.floor(random() * 4);
  const exitWall = walls.splice(exitWallIndex, 1)[0];
  const isVertical = exitWall.width < exitWall.height;
  const exitDoor: MazeExitDoor = {
    x: exitWall.x + exitWall.width / 2,
    y: exitWall.y + exitWall.height / 2,
    isVertical,
  };
  const remainingWallLength = (isVertical ? exitWall.height : exitWall.width)
    - MAZE_CORRIDOR_WIDTH;
  const segmentLength = remainingWallLength / 2;
  if (isVertical) {
    walls.push(
      { ...exitWall, height: segmentLength },
      {
        ...exitWall,
        y: exitDoor.y + MAZE_CORRIDOR_WIDTH / 2,
        height: segmentLength,
      },
    );
  } else {
    walls.push(
      { ...exitWall, width: segmentLength },
      {
        ...exitWall,
        x: exitDoor.x + MAZE_CORRIDOR_WIDTH / 2,
        width: segmentLength,
      },
    );
  }

  return {
    walls,
    walkableCells: cells.flat(),
    passages,
    exitDoor,
    start,
    seed: normalizedSeed,
  };
}

export function createRandomSeed(): number {
  return Math.floor(Math.random() * 0x1_0000_0000) >>> 0;
}

export function seedFromInput(input: string): number {
  const value = input.trim();
  if (/^\d+$/.test(value)) {
    const numericSeed = Number(value);
    if (Number.isSafeInteger(numericSeed)) {
      return numericSeed;
    }
  }

  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193);
  }
  return hash >>> 0;
}

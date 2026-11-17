/** Confirmed column order (client M1-2). */
export const COLUMN_IDS = ["wine", "rum", "tequila", "vodka", "whisky"] as const;

export type ColumnId = (typeof COLUMN_IDS)[number];

export const COLUMN_LABELS: Record<ColumnId, string> = {
  wine: "Wine",
  rum: "Rum",
  tequila: "Tequila",
  vodka: "Vodka",
  whisky: "Whisky",
};

/** 1-based column index matching client cost tables (Wine = 1 … Whisky = 5). */
export type ColumnIndex = 1 | 2 | 3 | 4 | 5;

export const LEVELS = [1, 2, 3, 4, 5] as const;
export type Level = (typeof LEVELS)[number];

/** Client M1-3: Level 1 is at the bottom of the board on screen. */
export type BoardRowOrientation = "level1-at-bottom";

export const DEFAULT_BOARD_ORIENTATION: BoardRowOrientation = "level1-at-bottom";

export type PlayerId = string;

export type CellOccupancy =
  | { kind: "empty" }
  | { kind: "built"; builtBy: PlayerId };

export interface BoardPosition {
  readonly column: ColumnId;
  readonly level: Level;
}

export interface PlayerBoard {
  readonly ownerId: PlayerId;
  /** 25 cells keyed by `${column}:${level}`. */
  readonly cells: Readonly<Record<string, CellOccupancy>>;
}

export function columnIdToIndex(column: ColumnId): ColumnIndex {
  const index = COLUMN_IDS.indexOf(column) + 1;
  if (index < 1 || index > 5) {
    throw new Error(`Unknown column: ${column}`);
  }
  return index as ColumnIndex;
}

export function columnIndexToId(index: ColumnIndex): ColumnId {
  const id = COLUMN_IDS[index - 1];
  if (!id) {
    throw new Error(`Invalid column index: ${index}`);
  }
  return id;
}

export function cellKey(column: ColumnId, level: Level): string {
  return `${column}:${level}`;
}

export function parseCellKey(key: string): BoardPosition {
  const [columnRaw, levelRaw] = key.split(":");
  if (!columnRaw || levelRaw === undefined) {
    throw new Error(`Invalid cell key: ${key}`);
  }
  if (!COLUMN_IDS.includes(columnRaw as ColumnId)) {
    throw new Error(`Invalid column in cell key: ${key}`);
  }
  const level = Number(levelRaw);
  if (![1, 2, 3, 4, 5].includes(level)) {
    throw new Error(`Invalid level in cell key: ${key}`);
  }
  return { column: columnRaw as ColumnId, level: level as Level };
}

export function createEmptyBoard(ownerId: PlayerId): PlayerBoard {
  const cells: Record<string, CellOccupancy> = {};
  for (const column of COLUMN_IDS) {
    for (const level of LEVELS) {
      cells[cellKey(column, level)] = { kind: "empty" };
    }
  }
  return { ownerId, cells };
}

export function listBoardPositions(): BoardPosition[] {
  const positions: BoardPosition[] = [];
  for (const column of COLUMN_IDS) {
    for (const level of LEVELS) {
      positions.push({ column, level });
    }
  }
  return positions;
}

export function assertBoardHas25Cells(board: PlayerBoard): void {
  const keys = Object.keys(board.cells);
  if (keys.length !== 25) {
    throw new Error(`Board for ${board.ownerId} must have 25 cells, found ${keys.length}`);
  }
}

/** True if any board has an exact build on the given level (any column). */
export function anyExactBuildOnLevel(
  boards: readonly PlayerBoard[],
  level: Level,
): boolean {
  for (const board of boards) {
    for (const column of COLUMN_IDS) {
      const cell = board.cells[cellKey(column, level)];
      if (cell?.kind === "built") {
        return true;
      }
    }
  }
  return false;
}

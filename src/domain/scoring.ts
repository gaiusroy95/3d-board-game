import {
  COLUMN_IDS,
  cellKey,
  type Level,
  type PlayerBoard,
} from "./board";

/**
 * Confirmed level scoring (client): Level 5 = 5 points; Levels 1–4 = 0.
 * Points from a Level 5 cell go to the **board owner**, not the builder (M1-4).
 */
export function scoreLevel(level: Level): number {
  return level === 5 ? 5 : 0;
}

/** Count Level 5 built cells on one board (checker foundation). */
export function countLevel5Builds(board: PlayerBoard): number {
  let count = 0;
  for (const column of COLUMN_IDS) {
    const cell = board.cells[cellKey(column, 5)];
    if (cell?.kind === "built") {
      count += 1;
    }
  }
  return count;
}

/** Board points from Level 5 cells only (each built L5 cell = +5 for owner). */
export function scoreBoardLevelCells(board: PlayerBoard): number {
  return countLevel5Builds(board) * scoreLevel(5);
}

/**
 * Client M1-8: each owned figurine is worth 5 points.
 * Unlock conditions / skill learning are OPEN — this only scores owned count.
 */
export function scoreFigurines(ownedFigurineCount: number): number {
  if (ownedFigurineCount < 0) {
    throw new Error("Figurine count cannot be negative");
  }
  return ownedFigurineCount * 5;
}

export function scorePlayerTotal(
  board: PlayerBoard,
  ownedFigurineCount: number,
): number {
  return scoreBoardLevelCells(board) + scoreFigurines(ownedFigurineCount);
}

import {
  COLUMN_IDS,
  LEVELS,
  type ColumnId,
  type Level,
} from "./board";

/**
 * Client: record lists per column + per level (calculating-rate money after builds).
 * Borrow 1 uses best column; Borrow 2 uses best level.
 * Borrow 4 uses max builds in one turn × 5600 (added to figurines×5600).
 */
export interface PlayerBankRecords {
  readonly columnSales: Readonly<Record<ColumnId, number>>;
  readonly levelSales: Readonly<Record<Level, number>>;
  readonly buildsThisTurn: number;
  readonly maxBuildsInOneTurn: number;
  readonly moneyFromRecycle: number;
  readonly moneySpentOnSpecialCards: number;
  readonly recycleActions: number;
}

export function emptyBankRecords(): PlayerBankRecords {
  const columnSales = Object.fromEntries(
    COLUMN_IDS.map((c) => [c, 0]),
  ) as Record<ColumnId, number>;
  const levelSales = Object.fromEntries(
    LEVELS.map((l) => [l, 0]),
  ) as Record<Level, number>;
  return {
    columnSales,
    levelSales,
    buildsThisTurn: 0,
    maxBuildsInOneTurn: 0,
    moneyFromRecycle: 0,
    moneySpentOnSpecialCards: 0,
    recycleActions: 0,
  };
}

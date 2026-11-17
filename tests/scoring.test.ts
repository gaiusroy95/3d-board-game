import { describe, expect, it } from "vitest";
import {
  cellKey,
  createEmptyBoard,
  type PlayerBoard,
} from "@domain/board";
import {
  countLevel5Builds,
  scoreFigurines,
  scoreLevel,
  scoreBoardLevelCells,
  scorePlayerTotal,
} from "@domain/scoring";
import { BUILD_COST, BUILD_MONEY_PAYOUT, COLUMN_MONEY_PERCENT } from "@domain/economy";

function withBuiltLevel5(board: PlayerBoard, columns: ("wine" | "rum")[]): PlayerBoard {
  const cells = { ...board.cells };
  for (const column of columns) {
    cells[cellKey(column, 5)] = { kind: "built", builtBy: "attacker" };
  }
  return { ...board, cells };
}

describe("scoreLevel", () => {
  it("returns 5 only for level 5", () => {
    expect(scoreLevel(1)).toBe(0);
    expect(scoreLevel(2)).toBe(0);
    expect(scoreLevel(3)).toBe(0);
    expect(scoreLevel(4)).toBe(0);
    expect(scoreLevel(5)).toBe(5);
  });
});

describe("level 5 checker and board owner scoring", () => {
  it("counts each level 5 build and awards 5 points each to the board", () => {
    const board = withBuiltLevel5(createEmptyBoard("owner"), ["wine", "rum"]);
    expect(countLevel5Builds(board)).toBe(2);
    expect(scoreBoardLevelCells(board)).toBe(10);
  });

  it("does not score levels 1–4 builds", () => {
    const board = createEmptyBoard("owner");
    const cells = { ...board.cells };
    cells[cellKey("wine", 1)] = { kind: "built", builtBy: "owner" };
    cells[cellKey("wine", 4)] = { kind: "built", builtBy: "owner" };
    const updated = { ...board, cells };
    expect(scoreBoardLevelCells(updated)).toBe(0);
  });
});

describe("figurines", () => {
  it("scores 5 points per owned figurine (max design 7)", () => {
    expect(scoreFigurines(0)).toBe(0);
    expect(scoreFigurines(7)).toBe(35);
    expect(scorePlayerTotal(createEmptyBoard("p"), 2)).toBe(10);
  });
});

describe("economy tables", () => {
  it("matches client column1 level1 money example (100)", () => {
    expect(BUILD_COST[1][1]).toBe(200);
    expect(BUILD_MONEY_PAYOUT[1][1]).toBe(100);
  });

  it("payout equals cost × column percent for all cells", () => {
    for (const column of [1, 2, 3, 4, 5] as const) {
      for (const level of [1, 2, 3, 4, 5] as const) {
        const expected = BUILD_COST[column][level] * COLUMN_MONEY_PERCENT[column];
        expect(BUILD_MONEY_PAYOUT[column][level]).toBe(expected);
      }
    }
  });
});

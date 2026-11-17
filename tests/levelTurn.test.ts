import { describe, expect, it } from "vitest";
import { cellKey, createEmptyBoard } from "@domain/board";
import {
  advanceTurn,
  createFourPlayerMatch,
  getActivePlayerId,
  resolveLevelTurnWithBuilds,
} from "@domain/match";

describe("level turns", () => {
  it("starts at level 1 with first player", () => {
    const match = createFourPlayerMatch({
      matchId: "m1",
      players: [
        { id: "p1", displayName: "A" },
        { id: "p2", displayName: "B" },
        { id: "p3", displayName: "C" },
        { id: "p4", displayName: "D" },
      ],
    });
    expect(match.rules.useLevelTurns).toBe(true);
    expect(match.levelTurn.activeLevel).toBe(1);
    expect(getActivePlayerId(match)).toBe("p1");
  });

  it("advances player and level together each End turn", () => {
    let match = createFourPlayerMatch({
      matchId: "m1",
      players: [
        { id: "p1", displayName: "A" },
        { id: "p2", displayName: "B" },
        { id: "p3", displayName: "C" },
        { id: "p4", displayName: "D" },
      ],
    });

    match = advanceTurn(match);
    expect(getActivePlayerId(match)).toBe("p2");
    expect(match.levelTurn.activeLevel).toBe(2);

    match = advanceTurn(match);
    expect(getActivePlayerId(match)).toBe("p3");
    expect(match.levelTurn.activeLevel).toBe(3);

    match = advanceTurn(match);
    expect(getActivePlayerId(match)).toBe("p4");
    expect(match.levelTurn.activeLevel).toBe(4);

    match = advanceTurn(match);
    expect(getActivePlayerId(match)).toBe("p1");
    expect(match.levelTurn.activeLevel).toBe(5);

    match = advanceTurn(match);
    expect(getActivePlayerId(match)).toBe("p2");
    expect(match.levelTurn.activeLevel).toBe(1);
  });

  it("resolveLevelTurnWithBuilds finds the next level that has builds", () => {
    const board = createEmptyBoard("p1");
    const cells = { ...board.cells };
    cells[cellKey("rum", 4)] = { kind: "built", builtBy: "p1" };
    const boards = [{ ...board, cells }];
    expect(resolveLevelTurnWithBuilds(boards, 1)).toBe(4);
  });
});

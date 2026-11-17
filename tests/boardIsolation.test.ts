import { describe, expect, it } from "vitest";
import { cellKey, createEmptyBoard } from "@domain/board";
import { applyBoardInteraction } from "@domain/buildDestroy";
import {
  advanceTurn,
  createFourPlayerMatch,
  replacePlayerBoard,
} from "@domain/match";

describe("board isolation", () => {
  it("creating a match yields four independent 25-cell boards", () => {
    const match = createFourPlayerMatch({
      matchId: "m1",
      players: [
        { id: "p1", displayName: "A" },
        { id: "p2", displayName: "B" },
        { id: "p3", displayName: "C" },
        { id: "p4", displayName: "D" },
      ],
    });

    expect(match.players).toHaveLength(4);
    for (const player of match.players) {
      expect(Object.keys(player.board.cells)).toHaveLength(25);
    }
  });

  it("replacing one board does not mutate another player's cells", () => {
    const match = createFourPlayerMatch({
      matchId: "m1",
      players: [
        { id: "p1", displayName: "A" },
        { id: "p2", displayName: "B" },
        { id: "p3", displayName: "C" },
        { id: "p4", displayName: "D" },
      ],
    });

    const p1Board = createEmptyBoard("p1");
    const cells = { ...p1Board.cells };
    cells[cellKey("whisky", 5)] = { kind: "built", builtBy: "p2" };
    const next = replacePlayerBoard(match, "p1", { ...p1Board, cells });

    expect(next.players.find((p) => p.id === "p1")?.board.cells[cellKey("whisky", 5)]?.kind).toBe(
      "built",
    );
    expect(next.players.find((p) => p.id === "p2")?.board.cells[cellKey("whisky", 5)]?.kind).toBe(
      "empty",
    );
    expect(match.players.find((p) => p.id === "p1")?.board.cells[cellKey("whisky", 5)]?.kind).toBe(
      "empty",
    );
  });
});

describe("build persistence", () => {
  it("places a build that remains after End turn", () => {
    const match = createFourPlayerMatch({
      matchId: "m1",
      players: [
        { id: "p1", displayName: "A" },
        { id: "p2", displayName: "B" },
        { id: "p3", displayName: "C" },
        { id: "p4", displayName: "D" },
      ],
    });

    const built = applyBoardInteraction(match, {
      type: "build",
      actorId: "p1",
      targetOwnerId: "p1",
      position: { column: "wine", level: 1 },
      specialConditionOrCardSatisfied: false,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    const afterTurn = advanceTurn(built.state);
    expect(
      afterTurn.players.find((p) => p.id === "p1")?.board.cells[cellKey("wine", 1)]?.kind,
    ).toBe("built");
    expect(afterTurn.levelTurn.activeLevel).toBe(2);
  });

  it("blocks opponent build without special condition/card", () => {
    const match = createFourPlayerMatch({
      matchId: "m1",
      players: [
        { id: "p1", displayName: "A" },
        { id: "p2", displayName: "B" },
        { id: "p3", displayName: "C" },
        { id: "p4", displayName: "D" },
      ],
    });

    const result = applyBoardInteraction(match, {
      type: "build",
      actorId: "p1",
      targetOwnerId: "p2",
      position: { column: "wine", level: 5 },
      specialConditionOrCardSatisfied: false,
    });
    expect(result.ok).toBe(false);
    expect(result.state).toBe(match);
  });

  it("blocks destroy until rules exist", () => {
    const match = createFourPlayerMatch({
      matchId: "m1",
      players: [
        { id: "p1", displayName: "A" },
        { id: "p2", displayName: "B" },
        { id: "p3", displayName: "C" },
        { id: "p4", displayName: "D" },
      ],
    });

    const result = applyBoardInteraction(match, {
      type: "destroy",
      actorId: "p1",
      targetOwnerId: "p2",
      position: { column: "rum", level: 3 },
    });
    expect(result.ok).toBe(false);
    expect(result.state).toBe(match);
  });
});

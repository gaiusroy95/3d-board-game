import { describe, expect, it } from "vitest";
import { applyBoardInteraction } from "@domain/buildDestroy";
import { createFourPlayerMatch } from "@domain/match";
import { returnMoneyForActiveLevel } from "@domain/levelPayout";
import { endTurnWithPayout } from "@domain/turnLifecycle";

function freshMatch() {
  return createFourPlayerMatch({
    matchId: "payout-test",
    players: [
      { id: "p1", displayName: "A" },
      { id: "p2", displayName: "B" },
      { id: "p3", displayName: "C" },
      { id: "p4", displayName: "D" },
    ],
  });
}

describe("M2-2 / M2-3 level payouts", () => {
  it("Normal: Wine L1 build pays 100 to board owner on End turn", () => {
    let match = freshMatch();
    const built = applyBoardInteraction(match, {
      type: "build",
      actorId: "p1",
      targetOwnerId: "p1",
      position: { column: "wine", level: 1 },
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    match = built.state;
    expect(match.players[0]!.cash).toBe(800);
    expect(match.bankBalance).toBe(200);

    const ended = endTurnWithPayout(match);
    match = ended.state;
    // Owner receives 100 Normal; bank had 200 → 100 left
    expect(match.players[0]!.cash).toBe(900);
    expect(match.bankBalance).toBe(100);
    expect(match.levelTurn.activeLevel).toBe(2);
    expect(match.levelTurn.activePlayerIndex).toBe(1);
  });

  it("Extra: opponent-board build pays Extra to builder + Normal to owner", () => {
    let match = freshMatch();
    match = {
      ...match,
      players: match.players.map((p) =>
        p.id === "p1" ? { ...p, canBuildOnOpponent: true } : p,
      ),
    };

    const built = applyBoardInteraction(match, {
      type: "build",
      actorId: "p1",
      targetOwnerId: "p2",
      position: { column: "wine", level: 1 },
      specialConditionOrCardSatisfied: true,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    match = built.state;

    const payout = returnMoneyForActiveLevel(match, 1);
    match = payout.state;

    const p1 = match.players.find((p) => p.id === "p1")!;
    const p2 = match.players.find((p) => p.id === "p2")!;
    // p1 paid 200, then Extra 100 → 900; p2 Normal 100
    expect(p1.cash).toBe(900);
    expect(p2.cash).toBe(1100);
    expect(payout.lines.some((l) => l.kind === "extra")).toBe(true);
  });

  it("blocks opponent build without permit", () => {
    const match = freshMatch();
    const built = applyBoardInteraction(match, {
      type: "build",
      actorId: "p1",
      targetOwnerId: "p2",
      position: { column: "wine", level: 1 },
    });
    expect(built.ok).toBe(false);
  });
});

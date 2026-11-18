import { describe, expect, it } from "vitest";
import { applyColumnHammer } from "@domain/cards/columnEffects";
import { applyBoardInteraction } from "@domain/buildDestroy";
import { createFourPlayerMatch } from "@domain/match";

describe("Hammer board-owner penalties", () => {
  it("board owner loses life and pays L1 fee on underflow", () => {
    let match = createFourPlayerMatch({
      matchId: "h",
      players: [
        { id: "p1", displayName: "A" },
        { id: "p2", displayName: "B" },
        { id: "p3", displayName: "C" },
        { id: "p4", displayName: "D" },
      ],
    });
    // Empty wine column — rank down 2 → underflow 2
    const hammer = applyColumnHammer(match, "p1", "p2", "wine", 2);
    expect(hammer.ok).toBe(true);
    if (!hammer.ok) return;
    const owner = hammer.state.players.find((p) => p.id === "p2")!;
    expect(owner.lives).toBe(2);
    // L1 wine cost 200 × 2 = 400
    expect(owner.cash).toBe(1000 - 400);
    expect(hammer.state.bankBalance).toBe(400);
    // Actor cash unchanged
    expect(hammer.state.players.find((p) => p.id === "p1")!.cash).toBe(1000);
  });

  it("removes builds before applying underflow", () => {
    let match = createFourPlayerMatch({
      matchId: "h",
      players: [
        { id: "p1", displayName: "A" },
        { id: "p2", displayName: "B" },
        { id: "p3", displayName: "C" },
        { id: "p4", displayName: "D" },
      ],
    });
    const built = applyBoardInteraction(match, {
      type: "build",
      actorId: "p2",
      targetOwnerId: "p2",
      position: { column: "wine", level: 1 },
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    match = built.state;
    const hammer = applyColumnHammer(match, "p1", "p2", "wine", 2);
    expect(hammer.ok).toBe(true);
    if (!hammer.ok) return;
    // Removed 1 build, underflow 1 → life -1, fee 200
    expect(hammer.state.players.find((p) => p.id === "p2")!.lives).toBe(2);
    expect(hammer.state.players.find((p) => p.id === "p2")!.board.cells["wine:1"]?.kind).toBe(
      "empty",
    );
  });
});

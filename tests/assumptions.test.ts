import { describe, expect, it } from "vitest";
import { M2Assumptions } from "@domain/assumptions";
import { createFourPlayerMatch } from "@domain/match";

describe("M2-0 assumptions / match setup", () => {
  it("uses documented starting cash and lives", () => {
    expect(M2Assumptions.startingCash).toBe(1000);
    expect(M2Assumptions.startingLives).toBe(3);

    const match = createFourPlayerMatch({
      matchId: "m2",
      players: [
        { id: "p1", displayName: "A" },
        { id: "p2", displayName: "B" },
        { id: "p3", displayName: "C" },
        { id: "p4", displayName: "D" },
      ],
    });

    for (const player of match.players) {
      expect(player.cash).toBe(1000);
      expect(player.lives).toBe(3);
      expect(player.canBuildOnOpponent).toBe(false);
    }
    expect(match.bankBalance).toBe(0);
  });
});

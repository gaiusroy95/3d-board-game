import { describe, expect, it } from "vitest";
import { createFourPlayerMatch } from "@domain/match";
import { evaluateMatchOutcomes } from "@domain/winLose";

describe("M2-6 win/lose", () => {
  it("marks lose on zero lives", () => {
    let match = createFourPlayerMatch({
      matchId: "wl",
      players: [
        { id: "p1", displayName: "A" },
        { id: "p2", displayName: "B" },
        { id: "p3", displayName: "C" },
        { id: "p4", displayName: "D" },
      ],
    });
    match = {
      ...match,
      players: match.players.map((p) =>
        p.id === "p1" ? { ...p, lives: 0 } : p,
      ),
    };
    const out = evaluateMatchOutcomes(match);
    expect(out.byPlayer.p1?.status).toBe("lost");
  });

  it("marks lose on cash at or below -7000", () => {
    let match = createFourPlayerMatch({
      matchId: "wl",
      players: [
        { id: "p1", displayName: "A" },
        { id: "p2", displayName: "B" },
        { id: "p3", displayName: "C" },
        { id: "p4", displayName: "D" },
      ],
    });
    match = {
      ...match,
      players: match.players.map((p) =>
        p.id === "p1" ? { ...p, cash: -7000 } : p,
      ),
    };
    const out = evaluateMatchOutcomes(match);
    expect(out.byPlayer.p1?.status).toBe("lost");
  });
});

import { describe, expect, it } from "vitest";
import { createFourPlayerMatch } from "@domain/match";
import { evaluateMatchOutcomes, pickFirstOnTop } from "@domain/winLose";

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

  it("70 points makes you the winner", () => {
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
        p.id === "p1"
          ? { ...p, objectivePoints: 70, lastRecordedScore: 70, scorePeakTurnIndex: 2 }
          : p,
      ),
    };
    const out = evaluateMatchOutcomes(match);
    expect(out.byPlayer.p1?.status).toBe("winner");
    expect(out.pointsWinnerId).toBe("p1");
  });

  it("tie uses first on top (earlier score peak turn)", () => {
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
      turnIndex: 10,
      players: match.players.map((p) => {
        if (p.id === "p1") {
          return {
            ...p,
            objectivePoints: 70,
            lastRecordedScore: 70,
            scorePeakTurnIndex: 5,
          };
        }
        if (p.id === "p2") {
          return {
            ...p,
            objectivePoints: 70,
            lastRecordedScore: 70,
            scorePeakTurnIndex: 3,
          };
        }
        return p;
      }),
    };
    expect(pickFirstOnTop(match, ["p1", "p2"])).toBe("p2");
    const out = evaluateMatchOutcomes(match);
    expect(out.pointsWinnerId).toBe("p2");
  });
});

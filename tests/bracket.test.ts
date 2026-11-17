import { describe, expect, it } from "vitest";
import {
  BRACKET_SHAPE,
  collectStageWinners,
  createTournamentShell,
  placeWinnersIntoNextStage,
} from "@domain/tournament";

describe("tournament bracket shape", () => {
  it("uses 64→16→4→1 match counts", () => {
    expect(BRACKET_SHAPE.round1).toEqual({ entrants: 64, matches: 16, advancing: 16 });
    expect(BRACKET_SHAPE.round2).toEqual({ entrants: 16, matches: 4, advancing: 4 });
    expect(BRACKET_SHAPE.final).toEqual({ entrants: 4, matches: 1, advancing: 1 });
  });

  it("creates a shell with correct stage sizes", () => {
    const tournament = createTournamentShell({ id: "t1", name: "Test Cup" });
    expect(tournament.stages.map((s) => s.matchCount)).toEqual([16, 4, 1]);
  });
});

describe("winner advancement", () => {
  it("collects explicit winners and places them into round 2 as groups of 4", () => {
    const tournament = createTournamentShell({ id: "t1", name: "Test Cup" });
    const round1 = tournament.stages[0];
    if (!round1) throw new Error("missing round1");

    const results = round1.matches.map((m, i) => ({
      matchId: m.id,
      winnerPlayerId: `w${i + 1}`,
    }));

    const winners = collectStageWinners(round1, results);
    expect(winners).toHaveLength(16);

    const round2 = tournament.stages[1];
    if (!round2) throw new Error("missing round2");

    const filled = placeWinnersIntoNextStage(round2, winners);
    expect(filled.matches).toHaveLength(4);
    expect(filled.matches[0]?.participants.map((p) => p.playerId)).toEqual([
      "w1",
      "w2",
      "w3",
      "w4",
    ]);
    expect(filled.matches[3]?.participants.map((p) => p.playerId)).toEqual([
      "w13",
      "w14",
      "w15",
      "w16",
    ]);
  });

  it("rejects missing winners instead of inventing them", () => {
    const tournament = createTournamentShell({ id: "t1", name: "Test Cup" });
    const round1 = tournament.stages[0];
    if (!round1) throw new Error("missing round1");
    expect(() => collectStageWinners(round1, [])).toThrow(/expects 16 results/);
  });
});

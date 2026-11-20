import { describe, expect, it } from "vitest";
import { scoreForPlayer } from "../src/domain/match";
import {
  assertPhaseStartScores,
  createMatchFromTournamentSeat,
} from "../src/domain/tournamentMatchStart";
import { PHASE_FINAL, PHASE_ROUND2 } from "../src/domain/tournamentPhase";
import type { TournamentMatch } from "../src/domain/tournament";
import {
  createTournament,
  fillRosterWithPlaceholders,
  knockOutParticipant,
  startTournament,
} from "../src/domain/tournamentOps";

function demoMatch(stageId: "round2" | "final"): TournamentMatch {
  return {
    id: `${stageId}-match-1`,
    stageId,
    participants: [
      { playerId: "a", displayName: "A", knockedOut: false },
      { playerId: "b", displayName: "B", knockedOut: false },
      { playerId: "c", displayName: "C", knockedOut: false },
      { playerId: "d", displayName: "D", knockedOut: false },
    ],
    winnerPlayerId: null,
    schedule: null,
    status: "ready",
  };
}

describe("tournament phase match start", () => {
  it("round2 starts at 10 figurine points and cash 3000", () => {
    const state = createMatchFromTournamentSeat(demoMatch("round2"), "round2");
    assertPhaseStartScores(state, PHASE_ROUND2);
    for (const p of state.players) {
      expect(p.cash).toBe(3000);
      expect(p.ownedFigurines).toBe(2);
      expect(scoreForPlayer(state, p.id)).toBe(10);
    }
  });

  it("final starts with 2 figurines and 10 points, cash 4000", () => {
    const state = createMatchFromTournamentSeat(demoMatch("final"), "final");
    assertPhaseStartScores(state, PHASE_FINAL);
    for (const p of state.players) {
      expect(p.cash).toBe(4000);
      expect(p.ownedFigurines).toBe(2);
      expect(scoreForPlayer(state, p.id)).toBe(10);
      expect(p.board.cells["wine:3"]?.kind).toBe("built");
      expect(p.board.cells["whisky:1"]?.kind).toBe("built");
    }
  });

  it("no-show knockout auto-wins when one player remains", () => {
    let t = createTournament({ id: "ko", name: "Cup" });
    t = fillRosterWithPlaceholders(t).tournament;
    t = startTournament(t, { rng: () => 0.4 }).tournament;
    const match = t.stages[0]!.matches[0]!;
    const [a, b, c, d] = match.participants;
    t = knockOutParticipant(t, match.id, a!.playerId).tournament;
    t = knockOutParticipant(t, match.id, b!.playerId).tournament;
    const last = knockOutParticipant(t, match.id, c!.playerId);
    expect(last.ok).toBe(true);
    if (!last.ok) return;
    const updated = last.tournament.stages[0]!.matches[0]!;
    expect(updated.status).toBe("completed");
    expect(updated.winnerPlayerId).toBe(d!.playerId);
  });
});

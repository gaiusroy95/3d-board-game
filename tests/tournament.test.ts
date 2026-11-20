import { describe, expect, it } from "vitest";
import {
  createTournament,
  fillRosterWithPlaceholders,
  recordMatchWinner,
  startTournament,
} from "../src/domain/tournamentOps";
import { TOURNAMENT_PHASE_PRESETS } from "../src/domain/tournamentPhase";

describe("M4 tournament bracket", () => {
  it("fills 64, random seats round1, advances to round2 then final standings", () => {
    let t = createTournament({ id: "t1", name: "Cup" });
    const filled = fillRosterWithPlaceholders(t, () => 0.5);
    expect(filled.ok).toBe(true);
    if (!filled.ok) return;
    t = filled.tournament;
    expect(t.roster).toHaveLength(64);
    expect(t.status).toBe("ready");

    const started = startTournament(t, {
      startsAtUtc: "2030-01-01T12:00:00.000Z",
      rng: () => 0.2,
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    t = started.tournament;
    expect(t.status).toBe("running");
    const r1 = t.stages.find((s) => s.id === "round1")!;
    expect(r1.matches.every((m) => m.participants.length === 4)).toBe(true);
    expect(r1.phaseSettings.startingCash).toBe(
      TOURNAMENT_PHASE_PRESETS.round1.startingCash,
    );

    for (const match of r1.matches) {
      const winner = match.participants[0]!.playerId;
      const next = recordMatchWinner(t, match.id, winner);
      expect(next.ok).toBe(true);
      if (!next.ok) return;
      t = next.tournament;
    }

    const r2 = t.stages.find((s) => s.id === "round2")!;
    expect(r2.matches.every((m) => m.participants.length === 4)).toBe(true);
    expect(r2.phaseSettings.startingCash).toBe(3000);
    expect(r2.phaseSettings.ownedFigurines).toBe(2);

    for (const match of r2.matches) {
      const winner = match.participants[0]!.playerId;
      const next = recordMatchWinner(t, match.id, winner);
      expect(next.ok).toBe(true);
      if (!next.ok) return;
      t = next.tournament;
    }

    const fin = t.stages.find((s) => s.id === "final")!;
    expect(fin.matches[0]!.participants).toHaveLength(4);
    expect(fin.phaseSettings.startingCash).toBe(4000);

    const champ = fin.matches[0]!.participants[0]!.playerId;
    const done = recordMatchWinner(t, fin.matches[0]!.id, champ);
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.tournament.status).toBe("completed");
    expect(done.tournament.standings.firstPlayerId).toBe(champ);
    expect(done.tournament.standings.secondPlayerId).toBeTruthy();
    expect(done.tournament.standings.thirdPlayerId).toBeTruthy();
  });

  it("rejects second winner override", () => {
    let t = createTournament({ id: "t2", name: "Cup" });
    t = fillRosterWithPlaceholders(t).tournament;
    t = startTournament(t, { rng: () => 0.1 }).tournament;
    const match = t.stages[0]!.matches[0]!;
    const a = match.participants[0]!.playerId;
    const b = match.participants[1]!.playerId;
    t = recordMatchWinner(t, match.id, a).tournament;
    const again = recordMatchWinner(t, match.id, b);
    expect(again.ok).toBe(false);
  });

  it("lets admin set match schedule time", async () => {
    const { setMatchSchedule } = await import("../src/domain/tournamentOps");
    let t = createTournament({ id: "t3", name: "Cup" });
    t = fillRosterWithPlaceholders(t).tournament;
    t = startTournament(t, { rng: () => 0.3 }).tournament;
    const matchId = t.stages[0]!.matches[0]!.id;
    const next = setMatchSchedule(t, matchId, "2031-06-01T15:30:00.000Z");
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(
      next.tournament.stages[0]!.matches[0]!.schedule?.startsAtUtc,
    ).toBe("2031-06-01T15:30:00.000Z");
  });
});

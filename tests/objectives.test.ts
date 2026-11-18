import { describe, expect, it } from "vitest";
import { createFourPlayerMatch, scoreForPlayer } from "@domain/match";
import {
  evaluateAllObjectives,
  recordBuildPlaced,
  recordMoneyFromBorrows,
  recordKnockout,
  selectRaceObjective,
  syncKnockoutsFromLives,
  tryClaimAnytimeObjective,
  tryClaimRaceObjective,
} from "@domain/objectives";

function matchWith(overrides?: {
  ownedFigurines?: number;
  builds?: number;
  cash?: number;
  objectivePoints?: number;
}) {
  const m = createFourPlayerMatch({
    matchId: "obj-test",
    players: [
      {
        id: "p1",
        displayName: "P1",
        ownedFigurines: overrides?.ownedFigurines ?? 1,
      },
      { id: "p2", displayName: "P2" },
      { id: "p3", displayName: "P3" },
      { id: "p4", displayName: "P4" },
    ],
  });
  let next = m;
  if (overrides?.builds) {
    for (let i = 0; i < overrides.builds; i++) {
      next = recordBuildPlaced(next, "p1");
    }
  }
  if (overrides?.cash != null || overrides?.objectivePoints != null) {
    next = {
      ...next,
      players: next.players.map((p) =>
        p.id === "p1"
          ? {
              ...p,
              cash: overrides.cash ?? p.cash,
              objectivePoints: overrides.objectivePoints ?? p.objectivePoints,
            }
          : p,
      ),
    };
  }
  return next;
}

describe("objectives", () => {
  it("allows selecting at most 4 of 7 race objectives", () => {
    let state = matchWith();
    const ids = [
      "race-3-figurines",
      "race-10-builds",
      "race-10-skills",
      "race-20-specials",
      "race-7-lives",
    ] as const;
    for (let i = 0; i < 4; i++) {
      const id = ids[i]!;
      const r = selectRaceObjective(state, "p1", id);
      expect(r.ok).toBe(true);
      state = r.state;
    }
    const fifth = selectRaceObjective(state, "p1", ids[4]!);
    expect(fifth.ok).toBe(false);
  });

  it("awards +5 for first-to-3 figurines when selected and met", () => {
    let state = matchWith({ ownedFigurines: 3 });
    state = selectRaceObjective(state, "p1", "race-3-figurines").state;
    const claim = tryClaimRaceObjective(state, "p1", "race-3-figurines");
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;
    expect(claim.state.objectives.raceClaimedBy["race-3-figurines"]).toBe("p1");
    expect(
      claim.state.players.find((p) => p.id === "p1")?.objectivePoints,
    ).toBe(5);
  });

  it("blocks race claim if not selected", () => {
    const state = matchWith({ ownedFigurines: 3 });
    const claim = tryClaimRaceObjective(state, "p1", "race-3-figurines");
    expect(claim.ok).toBe(false);
  });

  it("claims anytime borrow cash objective", () => {
    let state = matchWith();
    state = recordMoneyFromBorrows(state, "p1", 15_000);
    const claim = tryClaimAnytimeObjective(state, "p1", "money-borrow-15k");
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;
    expect(claim.state.objectives.anytimeClaimedBy["money-borrow-15k"]).toContain(
      "p1",
    );
  });

  it("opens select window when any player reaches 20 points", () => {
    let state = matchWith({ objectivePoints: 20 });
    const result = evaluateAllObjectives(state);
    expect(result.state.objectives.selectWindowOpened).toBe(true);
    expect(result.state.objectives.selectTurnsRemaining).toBe(3);
  });

  it("records survival at first knockout", () => {
    let state = matchWith();
    state = {
      ...state,
      playersKnockedOut: 1,
      players: state.players.map((p) =>
        p.id === "p2"
          ? { ...p, lives: 0 }
          : p.id === "p1"
            ? { ...p, lives: 6 }
            : p,
      ),
    };
    state = recordKnockout(state);
    expect(
      state.players.find((p) => p.id === "p1")?.objectiveStats.livesAtFirstKnockout,
    ).toBe(6);
    const claim = tryClaimAnytimeObjective(
      state,
      "p1",
      "survive-5-lives-until-first-ko",
    );
    expect(claim.ok).toBe(true);
  });

  it("syncKnockoutsFromLives increments and snapshots", () => {
    let state = matchWith();
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === "p2" ? { ...p, lives: 0 } : p.id === "p1" ? { ...p, lives: 5 } : p,
      ),
    };
    state = syncKnockoutsFromLives(state);
    expect(state.playersKnockedOut).toBe(1);
    expect(
      state.players.find((p) => p.id === "p1")?.objectiveStats.livesAtFirstKnockout,
    ).toBe(5);
  });

  it("includes objectivePoints in total score", () => {
    const state = matchWith({ objectivePoints: 10, ownedFigurines: 1 });
    expect(scoreForPlayer(state, "p1")).toBeGreaterThanOrEqual(10);
  });
});

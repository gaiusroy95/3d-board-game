import type { ColumnId, Level, PlayerId } from "./board";
import { getPlayer, scoreForPlayer, type MatchState } from "./match";
import {
  ANYTIME_OBJECTIVES,
  MAX_RACE_OBJECTIVE_SELECTIONS,
  RACE_OBJECTIVES,
  type AnytimeObjectiveId,
  type PlayerObjectiveStats,
  type RaceObjectiveId,
} from "./objectiveTypes";

export * from "./objectiveTypes";

export type ObjectiveActionResult =
  | { readonly ok: true; readonly state: MatchState; readonly note: string }
  | { readonly ok: false; readonly state: MatchState; readonly reason: string };

function countLearnedSkills(state: MatchState, playerId: PlayerId): number {
  const player = getPlayer(state, playerId);
  let n = 0;
  for (const s of player.figurineSkills) {
    if (s.skill1Learned) n += 1;
    if (s.skill2Learned) n += 1;
  }
  return Math.max(n, player.objectiveStats.skillsLearned);
}

function raceConditionMet(
  state: MatchState,
  playerId: PlayerId,
  id: RaceObjectiveId,
): boolean {
  const p = getPlayer(state, playerId);
  const s = p.objectiveStats;
  switch (id) {
    case "race-3-figurines":
      return p.ownedFigurines >= 3;
    case "race-10-builds":
      return s.buildsPlaced >= 10;
    case "race-10-skills":
      return countLearnedSkills(state, playerId) >= 10;
    case "race-20-specials":
      return s.specialCardsPlayed >= 20;
    case "race-7-lives":
      return p.lives >= 7;
    case "race-whisky-l3-x10":
      return s.whiskyL3Payouts >= 10;
    case "race-vodka-l4-x10-whisky-l4-x5":
      return s.vodkaL4Payouts >= 10 && s.whiskyL4Payouts >= 5;
    default:
      return false;
  }
}

function anytimeConditionMet(
  state: MatchState,
  playerId: PlayerId,
  id: AnytimeObjectiveId,
): boolean {
  const p = getPlayer(state, playerId);
  const s = p.objectiveStats;
  switch (id) {
    case "money-skills-15k":
      return s.moneyFromSkills >= 15_000;
    case "money-borrow-15k":
      return s.moneyFromBorrows >= 15_000;
    case "money-skills-30k":
      return s.moneyFromSkills >= 30_000;
    case "money-borrow-30k":
      return s.moneyFromBorrows >= 30_000;
    case "money-skills-45k":
      return s.moneyFromSkills >= 45_000;
    case "money-borrow-45k":
      return s.moneyFromBorrows >= 45_000;
    case "survive-5-lives-until-first-ko":
      return (
        state.playersKnockedOut >= 1 &&
        s.livesAtFirstKnockout !== null &&
        s.livesAtFirstKnockout >= 5
      );
    case "survive-until-2-ko":
      return state.playersKnockedOut >= 2 && s.survivedSecondKnockout;
    default:
      return false;
  }
}

export function selectRaceObjective(
  state: MatchState,
  playerId: PlayerId,
  objectiveId: RaceObjectiveId,
): ObjectiveActionResult {
  const player = getPlayer(state, playerId);
  if (player.selectedRaceObjectives.includes(objectiveId)) {
    return { ok: false, state, reason: "Already selected." };
  }
  if (player.selectedRaceObjectives.length >= MAX_RACE_OBJECTIVE_SELECTIONS) {
    return {
      ok: false,
      state,
      reason: `Can select at most ${MAX_RACE_OBJECTIVE_SELECTIONS} of 7 race objectives.`,
    };
  }
  if (state.objectives.raceClaimedBy[objectiveId]) {
    return {
      ok: false,
      state,
      reason: "That race objective was already won by someone else.",
    };
  }

  return {
    ok: true,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              selectedRaceObjectives: [...p.selectedRaceObjectives, objectiveId],
            }
          : p,
      ),
    },
    note: `Selected objective: ${objectiveId}.`,
  };
}

export function deselectRaceObjective(
  state: MatchState,
  playerId: PlayerId,
  objectiveId: RaceObjectiveId,
): ObjectiveActionResult {
  const player = getPlayer(state, playerId);
  if (!player.selectedRaceObjectives.includes(objectiveId)) {
    return { ok: false, state, reason: "Not selected." };
  }
  return {
    ok: true,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              selectedRaceObjectives: p.selectedRaceObjectives.filter(
                (id) => id !== objectiveId,
              ),
            }
          : p,
      ),
    },
    note: `Deselected objective: ${objectiveId}.`,
  };
}

function awardPoints(
  state: MatchState,
  playerId: PlayerId,
  points: number,
): MatchState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId
        ? { ...p, objectivePoints: p.objectivePoints + points }
        : p,
    ),
  };
}

export function tryClaimRaceObjective(
  state: MatchState,
  playerId: PlayerId,
  objectiveId: RaceObjectiveId,
): ObjectiveActionResult {
  if (state.objectives.raceClaimedBy[objectiveId]) {
    return { ok: false, state, reason: "Already claimed." };
  }
  const player = getPlayer(state, playerId);
  if (!player.selectedRaceObjectives.includes(objectiveId)) {
    return {
      ok: false,
      state,
      reason: "Select this race objective first (up to 4 of 7).",
    };
  }
  if (!raceConditionMet(state, playerId, objectiveId)) {
    return { ok: false, state, reason: "Condition not met yet." };
  }

  let next = awardPoints(state, playerId, 5);
  next = {
    ...next,
    objectives: {
      ...next.objectives,
      raceClaimedBy: {
        ...next.objectives.raceClaimedBy,
        [objectiveId]: playerId,
      },
    },
  };
  next = maybeOpenSelectWindow(next);
  return {
    ok: true,
    state: next,
    note: `Race objective claimed (+5 pts): ${objectiveId}.`,
  };
}

export function tryClaimAnytimeObjective(
  state: MatchState,
  playerId: PlayerId,
  objectiveId: AnytimeObjectiveId,
): ObjectiveActionResult {
  const claimed = state.objectives.anytimeClaimedBy[objectiveId] ?? [];
  if (claimed.includes(playerId)) {
    return { ok: false, state, reason: "Already claimed by you." };
  }
  if (!anytimeConditionMet(state, playerId, objectiveId)) {
    return { ok: false, state, reason: "Condition not met yet." };
  }

  let next = awardPoints(state, playerId, 5);
  next = {
    ...next,
    objectives: {
      ...next.objectives,
      anytimeClaimedBy: {
        ...next.objectives.anytimeClaimedBy,
        [objectiveId]: [...claimed, playerId],
      },
    },
  };
  next = maybeOpenSelectWindow(next);
  return {
    ok: true,
    state: next,
    note: `Anytime objective claimed (+5 pts): ${objectiveId}.`,
  };
}

export function evaluateObjectivesForPlayer(
  state: MatchState,
  playerId: PlayerId,
): { state: MatchState; notes: string[] } {
  let next = state;
  const notes: string[] = [];

  for (const def of RACE_OBJECTIVES) {
    if (next.objectives.raceClaimedBy[def.id]) continue;
    const player = getPlayer(next, playerId);
    if (!player.selectedRaceObjectives.includes(def.id as RaceObjectiveId)) {
      continue;
    }
    if (!raceConditionMet(next, playerId, def.id as RaceObjectiveId)) continue;
    const claimed = tryClaimRaceObjective(
      next,
      playerId,
      def.id as RaceObjectiveId,
    );
    if (claimed.ok) {
      next = claimed.state;
      notes.push(claimed.note);
    }
  }

  for (const def of ANYTIME_OBJECTIVES) {
    const claimed = tryClaimAnytimeObjective(
      next,
      playerId,
      def.id as AnytimeObjectiveId,
    );
    if (claimed.ok) {
      next = claimed.state;
      notes.push(claimed.note);
    }
  }

  return { state: next, notes };
}

export function evaluateAllObjectives(state: MatchState): {
  state: MatchState;
  notes: string[];
} {
  let next = maybeOpenSelectWindow(state);
  const notes: string[] = [];
  for (const id of next.playerOrder) {
    const result = evaluateObjectivesForPlayer(next, id);
    next = result.state;
    notes.push(...result.notes);
  }
  return { state: next, notes };
}

function maybeOpenSelectWindow(state: MatchState): MatchState {
  if (state.objectives.selectWindowOpened) return state;
  const anyoneAt20 = state.players.some(
    (p) => scoreForPlayer(state, p.id) >= 20,
  );
  if (!anyoneAt20) return state;
  return {
    ...state,
    objectives: {
      ...state.objectives,
      selectWindowOpened: true,
      selectTurnsRemaining: 3,
    },
  };
}

export function tickObjectiveSelectWindow(state: MatchState): MatchState {
  if (
    state.objectives.selectTurnsRemaining === null ||
    state.objectives.selectTurnsRemaining <= 0
  ) {
    return state;
  }
  return {
    ...state,
    objectives: {
      ...state.objectives,
      selectTurnsRemaining: state.objectives.selectTurnsRemaining - 1,
    },
  };
}

export function patchPlayerStats(
  state: MatchState,
  playerId: PlayerId,
  patch: Partial<PlayerObjectiveStats>,
): MatchState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId
        ? { ...p, objectiveStats: { ...p.objectiveStats, ...patch } }
        : p,
    ),
  };
}

export function recordBuildPlaced(
  state: MatchState,
  playerId: PlayerId,
): MatchState {
  const p = getPlayer(state, playerId);
  return patchPlayerStats(state, playerId, {
    buildsPlaced: p.objectiveStats.buildsPlaced + 1,
  });
}

export function recordSpecialCardPlayed(
  state: MatchState,
  playerId: PlayerId,
): MatchState {
  const p = getPlayer(state, playerId);
  return patchPlayerStats(state, playerId, {
    specialCardsPlayed: p.objectiveStats.specialCardsPlayed + 1,
  });
}

export function recordSkillLearned(
  state: MatchState,
  playerId: PlayerId,
): MatchState {
  const p = getPlayer(state, playerId);
  return patchPlayerStats(state, playerId, {
    skillsLearned: p.objectiveStats.skillsLearned + 1,
  });
}

export function recordMoneyFromSkills(
  state: MatchState,
  playerId: PlayerId,
  amount: number,
): MatchState {
  if (amount <= 0) return state;
  const p = getPlayer(state, playerId);
  return patchPlayerStats(state, playerId, {
    moneyFromSkills: p.objectiveStats.moneyFromSkills + amount,
  });
}

export function recordMoneyFromBorrows(
  state: MatchState,
  playerId: PlayerId,
  amount: number,
): MatchState {
  if (amount <= 0) return state;
  const p = getPlayer(state, playerId);
  return patchPlayerStats(state, playerId, {
    moneyFromBorrows: p.objectiveStats.moneyFromBorrows + amount,
  });
}

export function recordColumnLevelPayout(
  state: MatchState,
  playerId: PlayerId,
  column: ColumnId,
  level: Level,
): MatchState {
  const p = getPlayer(state, playerId);
  const s = p.objectiveStats;
  if (column === "whisky" && level === 3) {
    return patchPlayerStats(state, playerId, {
      whiskyL3Payouts: s.whiskyL3Payouts + 1,
    });
  }
  if (column === "vodka" && level === 4) {
    return patchPlayerStats(state, playerId, {
      vodkaL4Payouts: s.vodkaL4Payouts + 1,
    });
  }
  if (column === "whisky" && level === 4) {
    return patchPlayerStats(state, playerId, {
      whiskyL4Payouts: s.whiskyL4Payouts + 1,
    });
  }
  return state;
}

export function recordKnockout(state: MatchState): MatchState {
  const koCount = state.playersKnockedOut;
  if (koCount === 1) {
    return {
      ...state,
      players: state.players.map((p) =>
        p.lives > 0
          ? {
              ...p,
              objectiveStats: {
                ...p.objectiveStats,
                livesAtFirstKnockout: p.lives,
              },
            }
          : p,
      ),
    };
  }
  if (koCount === 2) {
    return {
      ...state,
      players: state.players.map((p) =>
        p.lives > 0
          ? {
              ...p,
              objectiveStats: {
                ...p.objectiveStats,
                survivedSecondKnockout: true,
              },
            }
          : p,
      ),
    };
  }
  return state;
}

/**
 * Sync playersKnockedOut to players with lives ≤ 0 and snapshot survival stats.
 */
export function syncKnockoutsFromLives(state: MatchState): MatchState {
  const dead = state.players.filter((p) => p.lives <= 0).length;
  if (dead <= state.playersKnockedOut) return state;
  let next = state;
  while (next.playersKnockedOut < dead) {
    next = {
      ...next,
      playersKnockedOut: next.playersKnockedOut + 1,
    };
    next = recordKnockout(next);
  }
  return next;
}

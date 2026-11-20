/**
 * Tournament system (M4): admin-managed 64 → 16 → 4 → 1.
 * Locked client answers in CLIENT_ANSWERS_M4.md.
 * Winner determination is supplied externally (match engine / demo record).
 */

import { phasePresetFor } from "./tournamentPhase";

export type TournamentStageId = "round1" | "round2" | "final";

/** registration → locked (64 filled) → running → completed. No pause/cancel (client). */
export type TournamentStatus =
  | "registration"
  | "ready"
  | "running"
  | "completed";

export interface ScheduleEntry {
  readonly id: string;
  readonly matchId: string;
  readonly startsAtUtc: string;
  readonly label: string;
}

export interface MatchParticipant {
  readonly playerId: string;
  readonly displayName: string;
  readonly seed?: number;
  /** Late / disconnect / no-show knockout flag. */
  readonly knockedOut: boolean;
}

export interface TournamentMatch {
  readonly id: string;
  readonly stageId: TournamentStageId;
  readonly participants: readonly MatchParticipant[];
  readonly winnerPlayerId: string | null;
  readonly schedule: ScheduleEntry | null;
  readonly status: "pending" | "ready" | "completed";
}

export interface TournamentStage {
  readonly id: TournamentStageId;
  readonly entrantCount: number;
  readonly matchCount: number;
  readonly advancingCount: number;
  readonly matches: readonly TournamentMatch[];
  readonly phaseSettings: ReturnType<typeof phasePresetFor>;
}

export interface TournamentEntrant {
  readonly playerId: string;
  readonly displayName: string;
}

/** Client: standings show winner, 2nd, 3rd. */
export interface TournamentStandings {
  readonly firstPlayerId: string | null;
  readonly secondPlayerId: string | null;
  readonly thirdPlayerId: string | null;
}

export interface Tournament {
  readonly id: string;
  readonly name: string;
  readonly status: TournamentStatus;
  readonly createdAtUtc: string;
  /** Official schedule anchor (UTC). Display may convert to local. */
  readonly scheduleTimezone: "UTC";
  readonly startsAtUtc: string | null;
  readonly roster: readonly TournamentEntrant[];
  readonly stages: readonly TournamentStage[];
  readonly standings: TournamentStandings;
}

export const BRACKET_SHAPE = {
  round1: { entrants: 64, matches: 16, advancing: 16 },
  round2: { entrants: 16, matches: 4, advancing: 4 },
  final: { entrants: 4, matches: 1, advancing: 1 },
} as const;

export const TOURNAMENT_ROSTER_SIZE = BRACKET_SHAPE.round1.entrants;

export function assertFourParticipants(match: TournamentMatch): void {
  if (match.participants.length !== 4) {
    throw new Error(`Tournament match ${match.id} must have 4 participants`);
  }
}

export function createEmptyBracketMatches(
  stageId: TournamentStageId,
  matchCount: number,
): TournamentMatch[] {
  return Array.from({ length: matchCount }, (_, i) => ({
    id: `${stageId}-match-${i + 1}`,
    stageId,
    participants: [],
    winnerPlayerId: null,
    schedule: null,
    status: "pending" as const,
  }));
}

function emptyStages(): TournamentStage[] {
  return (["round1", "round2", "final"] as const).map((id) => {
    const shape = BRACKET_SHAPE[id];
    return {
      id,
      entrantCount: shape.entrants,
      matchCount: shape.matches,
      advancingCount: shape.advancing,
      matches: createEmptyBracketMatches(id, shape.matches),
      phaseSettings: phasePresetFor(id),
    };
  });
}

export function createTournamentShell(input: {
  id: string;
  name: string;
  createdAtUtc?: string;
}): Tournament {
  return {
    id: input.id,
    name: input.name,
    status: "registration",
    createdAtUtc: input.createdAtUtc ?? new Date().toISOString(),
    scheduleTimezone: "UTC",
    startsAtUtc: null,
    roster: [],
    stages: emptyStages(),
    standings: {
      firstPlayerId: null,
      secondPlayerId: null,
      thirdPlayerId: null,
    },
  };
}

export interface MatchResultInput {
  readonly matchId: string;
  readonly winnerPlayerId: string;
}

/**
 * Given completed match results for a stage, return advancing winner ids in match order.
 */
export function collectStageWinners(
  stage: TournamentStage,
  results: readonly MatchResultInput[],
): string[] {
  if (results.length !== stage.matchCount) {
    throw new Error(
      `Stage ${stage.id} expects ${stage.matchCount} results, got ${results.length}`,
    );
  }

  const byId = new Map(results.map((r) => [r.matchId, r.winnerPlayerId]));
  const winners: string[] = [];

  for (const match of stage.matches) {
    const winner = byId.get(match.id);
    if (!winner) {
      throw new Error(`Missing winner for match ${match.id}`);
    }
    winners.push(winner);
  }

  if (winners.length !== stage.advancingCount) {
    throw new Error(
      `Stage ${stage.id} should advance ${stage.advancingCount}, got ${winners.length}`,
    );
  }

  return winners;
}

/**
 * Place advancing winners into the next stage as groups of 4 (input order).
 */
export function placeWinnersIntoNextStage(
  nextStage: TournamentStage,
  winnersInOrder: readonly string[],
  displayNames?: Readonly<Record<string, string>>,
): TournamentStage {
  if (winnersInOrder.length !== nextStage.entrantCount) {
    throw new Error(
      `Next stage ${nextStage.id} expects ${nextStage.entrantCount} entrants, got ${winnersInOrder.length}`,
    );
  }

  const matches = nextStage.matches.map((match, matchIndex) => {
    const slice = winnersInOrder.slice(matchIndex * 4, matchIndex * 4 + 4);
    if (slice.length !== 4) {
      throw new Error(`Could not form 4 participants for ${match.id}`);
    }
    const participants: MatchParticipant[] = slice.map((playerId) => ({
      playerId,
      displayName: displayNames?.[playerId] ?? playerId,
      knockedOut: false,
    }));
    return {
      ...match,
      participants,
      winnerPlayerId: null,
      status: "ready" as const,
    };
  });

  return { ...nextStage, matches };
}

export function findMatch(
  tournament: Tournament,
  matchId: string,
): { stage: TournamentStage; match: TournamentMatch; stageIndex: number; matchIndex: number } | null {
  for (let si = 0; si < tournament.stages.length; si++) {
    const stage = tournament.stages[si]!;
    const matchIndex = stage.matches.findIndex((m) => m.id === matchId);
    if (matchIndex >= 0) {
      return {
        stage,
        match: stage.matches[matchIndex]!,
        stageIndex: si,
        matchIndex,
      };
    }
  }
  return null;
}

export function displayNameMap(
  tournament: Tournament,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const e of tournament.roster) {
    map[e.playerId] = e.displayName;
  }
  for (const stage of tournament.stages) {
    for (const match of stage.matches) {
      for (const p of match.participants) {
        map[p.playerId] = p.displayName;
      }
    }
  }
  return map;
}

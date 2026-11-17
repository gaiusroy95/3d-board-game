/**
 * Tournament foundation: admin-managed 64 → 16 → 4 → 1.
 * Winner determination is supplied externally — never inferred here.
 */

export type TournamentStageId = "round1" | "round2" | "final";

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
}

export interface TournamentMatch {
  readonly id: string;
  readonly stageId: TournamentStageId;
  readonly participants: readonly MatchParticipant[];
  /** Exactly one winner id when the match is complete; null while pending. */
  readonly winnerPlayerId: string | null;
  readonly schedule: ScheduleEntry | null;
}

export interface TournamentStage {
  readonly id: TournamentStageId;
  readonly entrantCount: number;
  readonly matchCount: number;
  readonly advancingCount: number;
  readonly matches: readonly TournamentMatch[];
  /** OPEN: phase starting points / settings. */
  readonly phaseSettings: Record<string, unknown>;
}

export interface Tournament {
  readonly id: string;
  readonly name: string;
  readonly stages: readonly TournamentStage[];
}

export const BRACKET_SHAPE = {
  round1: { entrants: 64, matches: 16, advancing: 16 },
  round2: { entrants: 16, matches: 4, advancing: 4 },
  final: { entrants: 4, matches: 1, advancing: 1 },
} as const;

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
  }));
}

export function createTournamentShell(input: {
  id: string;
  name: string;
}): Tournament {
  return {
    id: input.id,
    name: input.name,
    stages: [
      {
        id: "round1",
        entrantCount: BRACKET_SHAPE.round1.entrants,
        matchCount: BRACKET_SHAPE.round1.matches,
        advancingCount: BRACKET_SHAPE.round1.advancing,
        matches: createEmptyBracketMatches("round1", BRACKET_SHAPE.round1.matches),
        phaseSettings: {},
      },
      {
        id: "round2",
        entrantCount: BRACKET_SHAPE.round2.entrants,
        matchCount: BRACKET_SHAPE.round2.matches,
        advancingCount: BRACKET_SHAPE.round2.advancing,
        matches: createEmptyBracketMatches("round2", BRACKET_SHAPE.round2.matches),
        phaseSettings: {},
      },
      {
        id: "final",
        entrantCount: BRACKET_SHAPE.final.entrants,
        matchCount: BRACKET_SHAPE.final.matches,
        advancingCount: BRACKET_SHAPE.final.advancing,
        matches: createEmptyBracketMatches("final", BRACKET_SHAPE.final.matches),
        phaseSettings: {},
      },
    ],
  };
}

export interface MatchResultInput {
  readonly matchId: string;
  /** Authoritative winner from game rules / admin — not client self-declaration in production. */
  readonly winnerPlayerId: string;
}

/**
 * Given completed match results for a stage, return advancing winner ids in match order.
 * Does not invent winners; every match must include an explicit winner in `results`.
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
 * Place advancing winners into the next stage as groups of 4.
 * Seeding policy is OPEN — uses input order.
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
    }));
    return {
      ...match,
      participants,
      winnerPlayerId: null,
    };
  });

  return { ...nextStage, matches };
}

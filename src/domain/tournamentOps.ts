/**
 * Pure tournament mutations (M4 locked rules).
 * - One tournament managed by caller (store).
 * - No pause/cancel/restart.
 * - Random Round 1 seating when 64 registered.
 * - Auto-advance on stage completion; no admin result override after recorded.
 * - Late/disconnect → knockout flag (winner still reported among active seats for demo).
 */

import {
  BRACKET_SHAPE,
  TOURNAMENT_ROSTER_SIZE,
  collectStageWinners,
  createTournamentShell,
  displayNameMap,
  findMatch,
  placeWinnersIntoNextStage,
  type MatchParticipant,
  type Tournament,
  type TournamentEntrant,
  type TournamentMatch,
  type TournamentStageId,
} from "./tournament";

export type TournamentOpResult =
  | { ok: true; tournament: Tournament; note: string }
  | { ok: false; tournament: Tournament; reason: string };

function shuffleInPlace<T>(items: T[], rng: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}

export function createTournament(input: {
  id?: string;
  name: string;
  now?: Date;
}): Tournament {
  const now = input.now ?? new Date();
  return createTournamentShell({
    id: input.id ?? `t-${now.getTime().toString(36)}`,
    name: input.name.trim() || "Tournament",
    createdAtUtc: now.toISOString(),
  });
}

export function registerEntrant(
  tournament: Tournament,
  entrant: TournamentEntrant,
): TournamentOpResult {
  if (tournament.status !== "registration") {
    return {
      ok: false,
      tournament,
      reason: "Registration is closed.",
    };
  }
  if (tournament.roster.length >= TOURNAMENT_ROSTER_SIZE) {
    return { ok: false, tournament, reason: "Roster is full (64/64)." };
  }
  if (tournament.roster.some((e) => e.playerId === entrant.playerId)) {
    return { ok: false, tournament, reason: "Player already registered." };
  }
  const roster = [
    ...tournament.roster,
    {
      playerId: entrant.playerId,
      displayName: entrant.displayName.trim() || entrant.playerId,
    },
  ];
  const status = roster.length === TOURNAMENT_ROSTER_SIZE ? "ready" : "registration";
  return {
    ok: true,
    tournament: { ...tournament, roster, status },
    note: `Registered ${entrant.displayName} (${roster.length}/${TOURNAMENT_ROSTER_SIZE}).`,
  };
}

/** Demo helper: fill remaining seats with placeholders. */
export function fillRosterWithPlaceholders(
  tournament: Tournament,
  rng: () => number = Math.random,
): TournamentOpResult {
  if (tournament.status !== "registration") {
    return { ok: false, tournament, reason: "Registration is closed." };
  }
  let next = tournament;
  let n = next.roster.length;
  while (n < TOURNAMENT_ROSTER_SIZE) {
    const id = `bot-${n + 1}-${Math.floor(rng() * 1e6).toString(36)}`;
    const result = registerEntrant(next, {
      playerId: id,
      displayName: `Player ${n + 1}`,
    });
    if (!result.ok) return result;
    next = result.tournament;
    n = next.roster.length;
  }
  return {
    ok: true,
    tournament: next,
    note: `Roster filled to ${TOURNAMENT_ROSTER_SIZE}.`,
  };
}

/**
 * Lock roster and randomly seat into Round 1 (client: random).
 * Requires exactly 64 entrants. Does not cancel/restart later.
 */
export function startTournament(
  tournament: Tournament,
  input: { startsAtUtc?: string; matchSpacingMinutes?: number; rng?: () => number } = {},
): TournamentOpResult {
  if (tournament.status === "running" || tournament.status === "completed") {
    return {
      ok: false,
      tournament,
      reason: "Tournament already started (cannot restart).",
    };
  }
  if (tournament.roster.length !== TOURNAMENT_ROSTER_SIZE) {
    return {
      ok: false,
      tournament,
      reason: `Need exactly ${TOURNAMENT_ROSTER_SIZE} players (have ${tournament.roster.length}).`,
    };
  }

  const rng = input.rng ?? Math.random;
  const shuffled = shuffleInPlace([...tournament.roster], rng);
  const round1 = tournament.stages.find((s) => s.id === "round1");
  if (!round1) {
    return { ok: false, tournament, reason: "Missing round1 stage." };
  }

  const startsAt = input.startsAtUtc
    ? new Date(input.startsAtUtc)
    : new Date(Date.now() + 5 * 60_000);
  const spacing = input.matchSpacingMinutes ?? 30;

  const matches: TournamentMatch[] = round1.matches.map((match, i) => {
    const slice = shuffled.slice(i * 4, i * 4 + 4);
    const participants: MatchParticipant[] = slice.map((e, seat) => ({
      playerId: e.playerId,
      displayName: e.displayName,
      seed: i * 4 + seat + 1,
      knockedOut: false,
    }));
    const start = new Date(startsAt.getTime() + i * spacing * 60_000);
    return {
      ...match,
      participants,
      status: "ready" as const,
      winnerPlayerId: null,
      schedule: {
        id: `sched-${match.id}`,
        matchId: match.id,
        startsAtUtc: start.toISOString(),
        label: `R1 · Match ${i + 1}`,
      },
    };
  });

  const stages = tournament.stages.map((s) =>
    s.id === "round1" ? { ...s, matches } : s,
  );

  return {
    ok: true,
    tournament: {
      ...tournament,
      status: "running",
      startsAtUtc: startsAt.toISOString(),
      stages,
    },
    note: "Tournament started — Round 1 seated randomly. Matches scheduled (UTC).",
  };
}

export function replaceEntrantInMatch(
  tournament: Tournament,
  matchId: string,
  oldPlayerId: string,
  replacement: TournamentEntrant,
): TournamentOpResult {
  if (tournament.status !== "running") {
    return { ok: false, tournament, reason: "Tournament is not running." };
  }
  const found = findMatch(tournament, matchId);
  if (!found) {
    return { ok: false, tournament, reason: "Match not found." };
  }
  if (found.match.status === "completed") {
    return { ok: false, tournament, reason: "Cannot replace after match completed." };
  }
  if (!found.match.participants.some((p) => p.playerId === oldPlayerId)) {
    return { ok: false, tournament, reason: "Player not in this match." };
  }
  if (
    found.match.participants.some((p) => p.playerId === replacement.playerId) &&
    replacement.playerId !== oldPlayerId
  ) {
    return { ok: false, tournament, reason: "Replacement already in match." };
  }

  const participants: MatchParticipant[] = found.match.participants.map(
    (p) => {
      if (p.playerId !== oldPlayerId) return p;
      const next: MatchParticipant = {
        playerId: replacement.playerId,
        displayName: replacement.displayName,
        knockedOut: false,
      };
      return p.seed !== undefined ? { ...next, seed: p.seed } : next;
    },
  );

  const match: TournamentMatch = { ...found.match, participants };
  const stage = {
    ...found.stage,
    matches: found.stage.matches.map((m, i) =>
      i === found.matchIndex ? match : m,
    ),
  };
  const stages = tournament.stages.map((s, i) =>
    i === found.stageIndex ? stage : s,
  );

  const roster = tournament.roster.map((e) =>
    e.playerId === oldPlayerId
      ? { playerId: replacement.playerId, displayName: replacement.displayName }
      : e,
  );

  return {
    ok: true,
    tournament: { ...tournament, stages, roster },
    note: `Replaced ${oldPlayerId} with ${replacement.displayName} in ${matchId}.`,
  };
}

/** Late / disconnect / no-show → knockout (client). */
export function knockOutParticipant(
  tournament: Tournament,
  matchId: string,
  playerId: string,
): TournamentOpResult {
  if (tournament.status !== "running") {
    return { ok: false, tournament, reason: "Tournament is not running." };
  }
  const found = findMatch(tournament, matchId);
  if (!found) {
    return { ok: false, tournament, reason: "Match not found." };
  }
  if (found.match.status === "completed") {
    return { ok: false, tournament, reason: "Match already completed." };
  }
  const participants = found.match.participants.map((p) =>
    p.playerId === playerId ? { ...p, knockedOut: true } : p,
  );
  if (!found.match.participants.some((p) => p.playerId === playerId)) {
    return { ok: false, tournament, reason: "Player not in match." };
  }

  const match = { ...found.match, participants };
  const stage = {
    ...found.stage,
    matches: found.stage.matches.map((m, i) =>
      i === found.matchIndex ? match : m,
    ),
  };
  const stages = tournament.stages.map((s, i) =>
    i === found.stageIndex ? stage : s,
  );

  return {
    ok: true,
    tournament: { ...tournament, stages },
    note: `${playerId} knocked out in ${matchId}.`,
  };
}

/**
 * Record match winner (auto-advance when stage complete).
 * Client: no admin override after the fact — call once.
 * Steam match play OPEN — demo may call this directly.
 */
export function recordMatchWinner(
  tournament: Tournament,
  matchId: string,
  winnerPlayerId: string,
): TournamentOpResult {
  if (tournament.status !== "running") {
    return { ok: false, tournament, reason: "Tournament is not running." };
  }
  const found = findMatch(tournament, matchId);
  if (!found) {
    return { ok: false, tournament, reason: "Match not found." };
  }
  if (found.match.status === "completed" || found.match.winnerPlayerId) {
    return {
      ok: false,
      tournament,
      reason: "Result already recorded (no override).",
    };
  }
  const winner = found.match.participants.find(
    (p) => p.playerId === winnerPlayerId,
  );
  if (!winner) {
    return { ok: false, tournament, reason: "Winner must be a participant." };
  }
  if (winner.knockedOut) {
    return { ok: false, tournament, reason: "Winner is knocked out." };
  }
  if (found.match.participants.length !== 4) {
    return { ok: false, tournament, reason: "Match needs 4 participants." };
  }

  const match: TournamentMatch = {
    ...found.match,
    winnerPlayerId,
    status: "completed",
  };
  let stage = {
    ...found.stage,
    matches: found.stage.matches.map((m, i) =>
      i === found.matchIndex ? match : m,
    ),
  };
  let stages = tournament.stages.map((s, i) =>
    i === found.stageIndex ? stage : s,
  );
  let next: Tournament = { ...tournament, stages };
  let note = `Winner recorded for ${matchId}: ${winner.displayName}.`;

  const stageComplete = stage.matches.every((m) => m.status === "completed");
  if (stageComplete) {
    const results = stage.matches.map((m) => ({
      matchId: m.id,
      winnerPlayerId: m.winnerPlayerId!,
    }));
    const winners = collectStageWinners(stage, results);
    const names = displayNameMap(next);

    if (stage.id === "final") {
      const finalMatch = stage.matches[0]!;
      const others = finalMatch.participants
        .filter((p) => p.playerId !== winnerPlayerId)
        .map((p) => p.playerId);
      // ASSUMPTION until client clarifies Final placements: seat order → 2nd, 3rd.
      next = {
        ...next,
        status: "completed",
        standings: {
          firstPlayerId: winnerPlayerId,
          secondPlayerId: others[0] ?? null,
          thirdPlayerId: others[1] ?? null,
        },
      };
      note += " Tournament complete — standings set (1st/2nd/3rd).";
    } else {
      const nextId: TournamentStageId =
        stage.id === "round1" ? "round2" : "final";
      const nextStage = next.stages.find((s) => s.id === nextId)!;
      const filled = placeWinnersIntoNextStage(nextStage, winners, names);
      const spaced = filled.matches.map((m, i) => {
        const base = next.startsAtUtc
          ? new Date(next.startsAtUtc).getTime()
          : Date.now();
        const offsetHours = stage.id === "round1" ? 24 : 48;
        const start = new Date(
          base + offsetHours * 3600_000 + i * 30 * 60_000,
        );
        return {
          ...m,
          schedule: {
            id: `sched-${m.id}`,
            matchId: m.id,
            startsAtUtc: start.toISOString(),
            label: `${nextId} · Match ${i + 1}`,
          },
        };
      });
      stages = next.stages.map((s) =>
        s.id === nextId ? { ...filled, matches: spaced } : s,
      );
      next = { ...next, stages };
      note += ` ${stage.id} complete — advanced to ${nextId}.`;
    }
  }

  return { ok: true, tournament: next, note };
}

/** Demo: pick first non-knocked-out participant as winner. */
export function simulateMatchWinner(
  tournament: Tournament,
  matchId: string,
): TournamentOpResult {
  const found = findMatch(tournament, matchId);
  if (!found) {
    return { ok: false, tournament, reason: "Match not found." };
  }
  const pick = found.match.participants.find((p) => !p.knockedOut);
  if (!pick) {
    return { ok: false, tournament, reason: "No eligible participant." };
  }
  return recordMatchWinner(tournament, matchId, pick.playerId);
}

/** Client: admin sets each match time. Stored as UTC ISO. */
export function setMatchSchedule(
  tournament: Tournament,
  matchId: string,
  startsAtUtc: string,
  label?: string,
): TournamentOpResult {
  if (tournament.status !== "running" && tournament.status !== "ready") {
    return {
      ok: false,
      tournament,
      reason: "Schedule matches after the tournament is ready/running.",
    };
  }
  const found = findMatch(tournament, matchId);
  if (!found) {
    return { ok: false, tournament, reason: "Match not found." };
  }
  if (found.match.status === "completed") {
    return { ok: false, tournament, reason: "Cannot reschedule a completed match." };
  }
  const parsed = Date.parse(startsAtUtc);
  if (Number.isNaN(parsed)) {
    return { ok: false, tournament, reason: "Invalid date/time." };
  }
  const iso = new Date(parsed).toISOString();
  const schedule = {
    id: found.match.schedule?.id ?? `sched-${matchId}`,
    matchId,
    startsAtUtc: iso,
    label: label?.trim() || found.match.schedule?.label || matchId,
  };
  const match: TournamentMatch = { ...found.match, schedule };
  const stage = {
    ...found.stage,
    matches: found.stage.matches.map((m, i) =>
      i === found.matchIndex ? match : m,
    ),
  };
  const stages = tournament.stages.map((s, i) =>
    i === found.stageIndex ? stage : s,
  );
  return {
    ok: true,
    tournament: { ...tournament, stages },
    note: `Admin set ${matchId} → ${iso} (UTC).`,
  };
}

export function listSchedule(tournament: Tournament) {
  return tournament.stages
    .flatMap((s) => s.matches)
    .filter((m) => m.schedule)
    .map((m) => m.schedule!)
    .sort((a, b) => a.startsAtUtc.localeCompare(b.startsAtUtc));
}

export function stageLabel(id: TournamentStageId): string {
  if (id === "round1") return `Round 1 (${BRACKET_SHAPE.round1.entrants})`;
  if (id === "round2") return `Round 2 (${BRACKET_SHAPE.round2.entrants})`;
  return "Final (4)";
}

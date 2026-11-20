import type { Tournament, TournamentEntrant } from "@domain/tournament";
import {
  createTournament,
  fillRosterWithPlaceholders,
  knockOutParticipant,
  recordMatchWinner,
  registerEntrant,
  replaceEntrantInMatch,
  setMatchSchedule,
  simulateMatchWinner,
  startTournament,
  type TournamentOpResult,
} from "@domain/tournamentOps";

const STORAGE_KEY = "m4.activeTournament";

/**
 * Single active tournament store (client: only one at a time).
 * Browser demo persists to localStorage. Steam match launch OPEN.
 */
export class TournamentStore {
  private tournament: Tournament | null = null;

  loadFromStorage(): Tournament | null {
    if (typeof window === "undefined") return this.tournament;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return this.tournament;
      this.tournament = JSON.parse(raw) as Tournament;
      return this.tournament;
    } catch {
      return this.tournament;
    }
  }

  private persist(t: Tournament | null): void {
    this.tournament = t;
    if (typeof window === "undefined") return;
    if (!t) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
  }

  getActive(): Tournament | null {
    return this.tournament ?? this.loadFromStorage();
  }

  /** Creates the only active tournament (replaces draft registration only). */
  createNew(name: string): TournamentOpResult {
    const current = this.getActive();
    if (current && (current.status === "running" || current.status === "completed")) {
      return {
        ok: false,
        tournament: current,
        reason: "An active tournament already exists (cannot create another).",
      };
    }
    const t = createTournament({ name });
    this.persist(t);
    return { ok: true, tournament: t, note: `Created “${t.name}”.` };
  }

  apply(op: (t: Tournament) => TournamentOpResult): TournamentOpResult {
    const current = this.getActive();
    if (!current) {
      return {
        ok: false,
        tournament: createTournament({ name: "—" }),
        reason: "No active tournament.",
      };
    }
    const result = op(current);
    if (result.ok) this.persist(result.tournament);
    return result;
  }

  register(entrant: TournamentEntrant): TournamentOpResult {
    return this.apply((t) => registerEntrant(t, entrant));
  }

  fillPlaceholders(): TournamentOpResult {
    return this.apply((t) => fillRosterWithPlaceholders(t));
  }

  start(startsAtUtc?: string): TournamentOpResult {
    return this.apply((t) =>
      startTournament(t, startsAtUtc ? { startsAtUtc } : {}),
    );
  }

  recordWinner(matchId: string, winnerPlayerId: string): TournamentOpResult {
    return this.apply((t) => recordMatchWinner(t, matchId, winnerPlayerId));
  }

  simulateWinner(matchId: string): TournamentOpResult {
    return this.apply((t) => simulateMatchWinner(t, matchId));
  }

  knockOut(matchId: string, playerId: string): TournamentOpResult {
    return this.apply((t) => knockOutParticipant(t, matchId, playerId));
  }

  replace(
    matchId: string,
    oldPlayerId: string,
    replacement: TournamentEntrant,
  ): TournamentOpResult {
    return this.apply((t) =>
      replaceEntrantInMatch(t, matchId, oldPlayerId, replacement),
    );
  }

  setMatchTime(matchId: string, startsAtUtc: string): TournamentOpResult {
    return this.apply((t) => setMatchSchedule(t, matchId, startsAtUtc));
  }

  /** Demo only — clear local tournament. Not a client “cancel” feature. */
  clearDemo(): void {
    this.persist(null);
  }
}

export const tournamentStore = new TournamentStore();

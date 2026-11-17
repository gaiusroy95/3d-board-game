import type {
  MatchResultInput,
  Tournament,
  TournamentStageId,
} from "@domain/tournament";

/**
 * Admin-managed tournament service contract.
 * Milestone 1: interface + in-memory stub only.
 * Do not trust a player client to finalize winners in production.
 */
export interface TournamentAdminService {
  getTournament(tournamentId: string): Promise<Tournament | null>;
  listTournaments(): Promise<readonly Tournament[]>;
  /**
   * Apply authoritative results for a stage. Implementations must verify admin auth.
   */
  submitStageResults(
    tournamentId: string,
    stageId: TournamentStageId,
    results: readonly MatchResultInput[],
  ): Promise<Tournament>;
}

export class InMemoryTournamentAdminStub implements TournamentAdminService {
  private readonly byId = new Map<string, Tournament>();

  seed(tournament: Tournament): void {
    this.byId.set(tournament.id, tournament);
  }

  async getTournament(tournamentId: string): Promise<Tournament | null> {
    return this.byId.get(tournamentId) ?? null;
  }

  async listTournaments(): Promise<readonly Tournament[]> {
    return [...this.byId.values()];
  }

  async submitStageResults(
    tournamentId: string,
    _stageId: TournamentStageId,
    _results: readonly MatchResultInput[],
  ): Promise<Tournament> {
    const tournament = this.byId.get(tournamentId);
    if (!tournament) {
      throw new Error(`Tournament not found: ${tournamentId}`);
    }
    // Advancement wiring belongs to later milestones; stub returns current shell.
    return tournament;
  }
}

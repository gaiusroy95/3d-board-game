import type { BoardInteractionRequest } from "@domain/buildDestroy";
import type { MatchState } from "@domain/match";

/**
 * Future multiplayer sync contract.
 * Milestone 1: interface only — no network implementation.
 * Production must validate identity, turn, and legality server-side / host-authoritatively.
 */
export interface MatchSyncService {
  getLocalMatch(): MatchState | null;
  submitInteraction(request: BoardInteractionRequest): Promise<void>;
  onMatchUpdated(handler: (state: MatchState) => void): () => void;
}

/** Local stub for prototype / tests. */
export class LocalMatchSyncStub implements MatchSyncService {
  private state: MatchState | null;
  private readonly listeners = new Set<(state: MatchState) => void>();

  constructor(initial: MatchState | null = null) {
    this.state = initial;
  }

  getLocalMatch(): MatchState | null {
    return this.state;
  }

  async submitInteraction(_request: BoardInteractionRequest): Promise<void> {
    // Local stub: networked mutations are not implemented in Milestone 1.
  }

  onMatchUpdated(handler: (state: MatchState) => void): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  /** Test/helper only — not a production winner declaration path. */
  replaceState(state: MatchState): void {
    this.state = state;
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}

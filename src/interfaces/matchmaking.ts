import { M3OnlineConfig } from "@domain/onlineConfig";
import type { PlayerId } from "@domain/board";

export interface MatchmakingPlayer {
  readonly id: PlayerId;
  readonly displayName: string;
  readonly ready: boolean;
  readonly steamId: string | null;
}

export interface MatchmakingTicket {
  readonly ticketId: string;
  readonly player: MatchmakingPlayer;
  readonly queuedAtMs: number;
}

export interface ReadyMatchRoom {
  readonly roomId: string;
  readonly players: readonly MatchmakingPlayer[];
}

/**
 * Public matchmaking (client M3): queue until 4 ready → form room.
 * Steam identity hooks later when App ID exists.
 */
export interface MatchmakingService {
  enqueue(player: Omit<MatchmakingPlayer, "ready"> & { ready?: boolean }): MatchmakingTicket;
  setReady(ticketId: string, ready: boolean): void;
  leave(ticketId: string): void;
  tryFormRoom(): ReadyMatchRoom | null;
  getQueue(): readonly MatchmakingTicket[];
}

export class InMemoryPublicMatchmaking implements MatchmakingService {
  private tickets: MatchmakingTicket[] = [];
  private seq = 0;

  enqueue(
    player: Omit<MatchmakingPlayer, "ready"> & { ready?: boolean },
  ): MatchmakingTicket {
    const existing = this.tickets.find((t) => t.player.id === player.id);
    if (existing) return existing;
    const ticket: MatchmakingTicket = {
      ticketId: `mm-${++this.seq}`,
      queuedAtMs: Date.now(),
      player: {
        id: player.id,
        displayName: player.displayName,
        steamId: player.steamId,
        ready: player.ready ?? false,
      },
    };
    this.tickets.push(ticket);
    return ticket;
  }

  setReady(ticketId: string, ready: boolean): void {
    this.tickets = this.tickets.map((t) =>
      t.ticketId === ticketId
        ? { ...t, player: { ...t.player, ready } }
        : t,
    );
  }

  leave(ticketId: string): void {
    this.tickets = this.tickets.filter((t) => t.ticketId !== ticketId);
  }

  tryFormRoom(): ReadyMatchRoom | null {
    const ready = this.tickets.filter((t) => t.player.ready);
    if (ready.length < M3OnlineConfig.startWhenReadyCount) return null;
    const taken = ready.slice(0, M3OnlineConfig.playersPerMatch);
    const ids = new Set(taken.map((t) => t.ticketId));
    this.tickets = this.tickets.filter((t) => !ids.has(t.ticketId));
    return {
      roomId: `room-${Date.now()}`,
      players: taken.map((t) => t.player),
    };
  }

  getQueue(): readonly MatchmakingTicket[] {
    return this.tickets;
  }
}

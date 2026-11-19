import type { PlayerId } from "./board";
import {
  getPlayer,
  type MatchState,
} from "./match";
import { M3OnlineConfig } from "./onlineConfig";
import { syncKnockoutsFromLives } from "./objectives";
import { endTurnWithPayout } from "./turnLifecycle";

export interface OnlineMatchMeta {
  readonly localPlayerId: PlayerId;
  /** Admin spectator sees all boards; normal players see own board. */
  readonly role: "player" | "admin-spectator";
  readonly turnDeadlineMs: number | null;
  readonly turnStartedAtMs: number | null;
}

export function createOnlineMeta(
  localPlayerId: PlayerId,
  role: "player" | "admin-spectator" = "player",
): OnlineMatchMeta {
  return {
    localPlayerId,
    role,
    turnDeadlineMs: null,
    turnStartedAtMs: null,
  };
}

export function startTurnTimer(
  meta: OnlineMatchMeta,
  nowMs: number = Date.now(),
): OnlineMatchMeta {
  return {
    ...meta,
    turnStartedAtMs: nowMs,
    turnDeadlineMs: nowMs + M3OnlineConfig.turnTimeoutMs,
  };
}

export function clearTurnTimer(meta: OnlineMatchMeta): OnlineMatchMeta {
  return { ...meta, turnStartedAtMs: null, turnDeadlineMs: null };
}

export function turnTimeRemainingMs(
  meta: OnlineMatchMeta,
  nowMs: number = Date.now(),
): number | null {
  if (meta.turnDeadlineMs == null) return null;
  return Math.max(0, meta.turnDeadlineMs - nowMs);
}

/**
 * Client: disconnect counts as knockout → lives to 0 + sync KO stats.
 */
export function applyDisconnectKnockout(
  state: MatchState,
  playerId: PlayerId,
): { state: MatchState; note: string } {
  const player = getPlayer(state, playerId);
  if (player.lives <= 0) {
    return { state, note: `${playerId} already knocked out.` };
  }
  let next: MatchState = {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId ? { ...p, lives: 0 } : p,
    ),
  };
  next = syncKnockoutsFromLives(next);
  return {
    state: next,
    note: `${playerId} disconnected — counted as knockout.`,
  };
}

/**
 * If turn timer expired, force End turn for the active player.
 */
export function forceEndTurnIfTimedOut(
  state: MatchState,
  meta: OnlineMatchMeta,
  nowMs: number = Date.now(),
): {
  state: MatchState;
  meta: OnlineMatchMeta;
  forced: boolean;
  note: string;
} {
  if (meta.turnDeadlineMs == null || nowMs < meta.turnDeadlineMs) {
    return { state, meta, forced: false, note: "" };
  }
  const ended = endTurnWithPayout(state);
  const nextMeta = startTurnTimer(clearTurnTimer(meta), nowMs);
  return {
    state: ended.state,
    meta: nextMeta,
    forced: true,
    note: `Turn timed out (3 min). ${ended.payoutNote}`,
  };
}

export function canViewBoard(
  meta: OnlineMatchMeta,
  boardOwnerId: PlayerId,
): boolean {
  if (meta.role === "admin-spectator") return true;
  if (M3OnlineConfig.playerViewMode !== "own-board") return true;
  return meta.localPlayerId === boardOwnerId;
}

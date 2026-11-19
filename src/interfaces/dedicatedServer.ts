import type { BoardInteractionRequest } from "@domain/buildDestroy";
import { applyBoardInteraction } from "@domain/buildDestroy";
import {
  createFourPlayerMatch,
  getActivePlayerId,
  type MatchState,
} from "@domain/match";
import {
  applyDisconnectKnockout,
  clearTurnTimer,
  createOnlineMeta,
  forceEndTurnIfTimedOut,
  startTurnTimer,
  type OnlineMatchMeta,
} from "@domain/onlineSession";
import { endTurnWithPayout } from "@domain/turnLifecycle";
import type { PlayerId } from "@domain/board";
import type { MatchmakingPlayer } from "./matchmaking";

export type ServerAction =
  | { type: "build-interaction"; playerId: PlayerId; request: BoardInteractionRequest }
  | { type: "end-turn"; playerId: PlayerId }
  | { type: "disconnect"; playerId: PlayerId }
  | { type: "tick-timer"; nowMs?: number };

export type ServerActionResult =
  | { ok: true; state: MatchState; meta: OnlineMatchMeta; note: string }
  | { ok: false; state: MatchState; meta: OnlineMatchMeta; reason: string };

/**
 * Authoritative match host brain (M3: host-authoritative; M4 may move to dedicated backend).
 * Validates turn ownership; applies domain mutations; owns turn timer.
 */
export class DedicatedMatchServer {
  private state: MatchState;
  private metaByPlayer = new Map<PlayerId, OnlineMatchMeta>();
  private sharedMeta: OnlineMatchMeta;

  constructor(roomPlayers: readonly MatchmakingPlayer[], adminSpectatorId?: PlayerId) {
    if (roomPlayers.length !== 4) {
      throw new Error("Dedicated match requires exactly 4 players.");
    }
    this.state = createFourPlayerMatch({
      matchId: `online-${Date.now()}`,
      players: roomPlayers.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        ownedFigurines: 1,
        figurineSkills: [
          { slotIndex: 0, skill1Learned: false, skill2Learned: false },
        ],
      })),
    });
    for (const p of roomPlayers) {
      this.metaByPlayer.set(p.id, createOnlineMeta(p.id, "player"));
    }
    if (adminSpectatorId) {
      this.metaByPlayer.set(
        adminSpectatorId,
        createOnlineMeta(adminSpectatorId, "admin-spectator"),
      );
    }
    const first = roomPlayers[0]!.id;
    this.sharedMeta = startTurnTimer(createOnlineMeta(first, "player"));
  }

  getState(): MatchState {
    return this.state;
  }

  getMetaFor(playerId: PlayerId): OnlineMatchMeta | null {
    return this.metaByPlayer.get(playerId) ?? null;
  }

  getSharedMeta(): OnlineMatchMeta {
    return this.sharedMeta;
  }

  dispatch(action: ServerAction): ServerActionResult {
    if (action.type === "tick-timer") {
      const timed = forceEndTurnIfTimedOut(
        this.state,
        this.sharedMeta,
        action.nowMs ?? Date.now(),
      );
      this.state = timed.state;
      this.sharedMeta = timed.meta;
      return {
        ok: true,
        state: this.state,
        meta: this.sharedMeta,
        note: timed.forced ? timed.note : "Timer ok.",
      };
    }

    if (action.type === "disconnect") {
      const result = applyDisconnectKnockout(this.state, action.playerId);
      this.state = result.state;
      return {
        ok: true,
        state: this.state,
        meta: this.sharedMeta,
        note: result.note,
      };
    }

    const active = getActivePlayerId(this.state);
    if (action.playerId !== active) {
      return {
        ok: false,
        state: this.state,
        meta: this.sharedMeta,
        reason: `Not your turn (active: ${active}).`,
      };
    }

    if (action.type === "end-turn") {
      const ended = endTurnWithPayout(this.state);
      this.state = ended.state;
      this.sharedMeta = startTurnTimer(clearTurnTimer(this.sharedMeta));
      return {
        ok: true,
        state: this.state,
        meta: this.sharedMeta,
        note: ended.payoutNote,
      };
    }

    const applied = applyBoardInteraction(this.state, action.request);
    if (!applied.ok) {
      return {
        ok: false,
        state: this.state,
        meta: this.sharedMeta,
        reason: applied.reason,
      };
    }
    this.state = applied.state;
    return {
      ok: true,
      state: this.state,
      meta: this.sharedMeta,
      note: applied.note,
    };
  }
}

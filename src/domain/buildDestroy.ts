import { cellKey, type BoardPosition, type PlayerId } from "./board";
import { getPlayer, replacePlayerBoard, type MatchState } from "./match";

/**
 * Build / destroy / opponent-board access.
 *
 * Client (M1-6): may build on both boards; building on another player's board
 * requires a special condition or special card (details OPEN).
 * Destroy rules remain OPEN from earlier requirements.
 *
 * Milestone 1 correction: own-board (and gated opponent) builds place a lasting
 * marker that persists across turns. Cash/money application remains Milestone 2+.
 */

export type BuildTargetKind = "own-board" | "opponent-board";

export interface BuildActionRequest {
  readonly type: "build";
  readonly actorId: PlayerId;
  readonly targetOwnerId: PlayerId;
  readonly position: BoardPosition;
  /** Must be true for opponent-board builds once cards/conditions exist. */
  readonly specialConditionOrCardSatisfied: boolean;
}

export interface DestroyActionRequest {
  readonly type: "destroy";
  readonly actorId: PlayerId;
  readonly targetOwnerId: PlayerId;
  readonly position: BoardPosition;
}

export type BoardInteractionRequest = BuildActionRequest | DestroyActionRequest;

export type BoardInteractionResult =
  | { readonly ok: true; readonly state: MatchState; readonly note: string }
  | { readonly ok: false; readonly reason: string; readonly state: MatchState };

export function targetKind(
  actorId: PlayerId,
  targetOwnerId: PlayerId,
): BuildTargetKind {
  return actorId === targetOwnerId ? "own-board" : "opponent-board";
}

/**
 * Apply build/destroy. Builds persist on the board across turns.
 * Destroy stays blocked until client defines effects.
 */
export function applyBoardInteraction(
  state: MatchState,
  request: BoardInteractionRequest,
): BoardInteractionResult {
  if (request.type === "destroy") {
    return {
      ok: false,
      reason:
        "Destroy rules are not finalized yet. No state change.",
      state,
    };
  }

  const kind = targetKind(request.actorId, request.targetOwnerId);
  if (kind === "opponent-board" && !request.specialConditionOrCardSatisfied) {
    return {
      ok: false,
      reason:
        "Building on another player's board requires a special condition or special card. No state change.",
      state,
    };
  }

  const target = getPlayer(state, request.targetOwnerId);
  const key = cellKey(request.position.column, request.position.level);
  const cell = target.board.cells[key];
  if (!cell) {
    return { ok: false, reason: `Unknown cell ${key}.`, state };
  }
  if (cell.kind === "built") {
    return {
      ok: false,
      reason: "That cell already has a build. No state change.",
      state,
    };
  }

  const cells = {
    ...target.board.cells,
    [key]: { kind: "built" as const, builtBy: request.actorId },
  };
  const next = replacePlayerBoard(state, request.targetOwnerId, {
    ...target.board,
    cells,
  });

  return {
    ok: true,
    state: next,
    note: `Build placed on ${request.targetOwnerId} ${request.position.column} L${request.position.level} (stays after End turn). Cash costs apply in a later milestone.`,
  };
}

/** @deprecated Use applyBoardInteraction — kept name alias for older call sites/tests. */
export const applyBoardInteractionNoOp = applyBoardInteraction;

import { M2Assumptions } from "./assumptions";
import { payBuildCost } from "./bank";
import { cellKey, type BoardPosition, type PlayerId } from "./board";
import { registerBoardBuildAdvantage } from "./borrows";
import { getPlayer, replacePlayerBoard, type MatchState } from "./match";
import { recordBuildPlaced } from "./objectives";

/**
 * Build / destroy / opponent-board access.
 *
 * Opponent board requires special card OR condition (permit flag).
 * Build pays cost table immediately into Bank (M2).
 * Destroy remains disabled (A10).
 */

export type BuildTargetKind = "own-board" | "opponent-board";

export interface BuildActionRequest {
  readonly type: "build";
  readonly actorId: PlayerId;
  readonly targetOwnerId: PlayerId;
  readonly position: BoardPosition;
  /**
   * Explicit card/condition satisfaction. Also accepts actor.canBuildOnOpponent.
   */
  readonly specialConditionOrCardSatisfied?: boolean;
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

function hasOpponentPermit(
  state: MatchState,
  actorId: PlayerId,
  explicit: boolean | undefined,
): boolean {
  if (explicit) return true;
  return getPlayer(state, actorId).canBuildOnOpponent;
}

/**
 * Apply build/destroy. Builds persist and cost cash immediately.
 */
export function applyBoardInteraction(
  state: MatchState,
  request: BoardInteractionRequest,
): BoardInteractionResult {
  if (request.type === "destroy") {
    if (!M2Assumptions.destroyEnabled) {
      return {
        ok: false,
        reason: "Destroy rules are not finalized yet. No state change.",
        state,
      };
    }
    return {
      ok: false,
      reason: "Destroy is not implemented.",
      state,
    };
  }

  const kind = targetKind(request.actorId, request.targetOwnerId);
  if (
    kind === "opponent-board" &&
    !hasOpponentPermit(state, request.actorId, request.specialConditionOrCardSatisfied)
  ) {
    return {
      ok: false,
      reason:
        "Building on another player's board requires a special condition or special card. No state change.",
      state,
    };
  }

  const target = getPlayer(state, request.targetOwnerId);
  const key = cellKey(request.position.column, request.position.level);
  if (state.blockedCells[key]) {
    const block = state.blockedCells[key]!;
    return {
      ok: false,
      reason: `Cell ${key} is blocked (by ${block.blockedBy}, ${block.turnsRemaining} turn(s) left). Master can unblock, or wait.`,
      state,
    };
  }
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

  const payment = payBuildCost(state, request.actorId, request.position);
  if (!payment.ok) {
    return { ok: false, reason: payment.reason, state: payment.state };
  }

  let next = payment.state;
  const targetAfterPay = getPlayer(next, request.targetOwnerId);
  const cells = {
    ...targetAfterPay.board.cells,
    [key]: { kind: "built" as const, builtBy: request.actorId },
  };
  next = replacePlayerBoard(next, request.targetOwnerId, {
    ...targetAfterPay.board,
    cells,
  });

  if (kind === "opponent-board") {
    next = registerBoardBuildAdvantage(
      next,
      request.targetOwnerId,
      request.actorId,
      request.position,
    );
  }

  next = recordBuildPlaced(next, request.actorId);

  const where =
    kind === "own-board"
      ? "own board"
      : `opponent board (${request.targetOwnerId})`;

  return {
    ok: true,
    state: next,
    note: `${payment.note} Build placed on ${where} ${request.position.column} L${request.position.level}.`,
  };
}

/** @deprecated Use applyBoardInteraction */
export const applyBoardInteractionNoOp = applyBoardInteraction;

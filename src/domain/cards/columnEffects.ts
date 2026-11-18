import {
  cellKey,
  columnIdToIndex,
  type ColumnId,
  type Level,
  type PlayerId,
} from "../board";
import { bankReceivePayment, bankPayToPlayer } from "../bank";
import { syncKnockoutsFromLives } from "../objectives";
import { getBuildCost, getBuildMoneyPayout } from "../economy";
import { getPlayer, replacePlayerBoard, type MatchState } from "../match";

export type ColumnCardActionResult =
  | { readonly ok: true; readonly state: MatchState; readonly note: string }
  | { readonly ok: false; readonly state: MatchState; readonly reason: string };

/**
 * Over-L5 bonus: L5+k → money value × k for one turn (client).
 * "value" = calculating-rate payout for that column at level 5 (ASSUMPTION until confirmed).
 */
export function overLevel5Multiplier(effectiveLevel: number): number {
  if (effectiveLevel <= 5) return 1;
  return effectiveLevel - 5;
}

/**
 * Master: rank-up build on column. Places/upgrades toward level = currentHighestEmpty+rank
 * or builds at min(5, ...) with over-5 cash bonus for the turn.
 *
 * Practical rule used:
 * - Find highest built level on that column for the target board (0 if none).
 * - New level = min(5, highest + rankUp) if highest+rankUp <= 5, else place/confirm at 5
 *   and grant over-L5 bonus cash (value × (highest+rankUp-5)).
 * - Can place on empty cell at the resolved level; if already built by actor, still OK for bonus only.
 */
export function applyColumnMaster(
  state: MatchState,
  actorId: PlayerId,
  targetOwnerId: PlayerId,
  column: ColumnId,
  rankUp: number,
): ColumnCardActionResult {
  const target = getPlayer(state, targetOwnerId);
  let highest = 0;
  for (let level = 1; level <= 5; level += 1) {
    const cell = target.board.cells[cellKey(column, level as Level)];
    if (cell?.kind === "built") highest = level;
  }

  const effective = highest + rankUp;
  const placeLevel = Math.min(5, Math.max(1, effective)) as Level;
  const key = cellKey(column, placeLevel);
  const cell = target.board.cells[key];
  if (!cell) {
    return { ok: false, state, reason: `Unknown cell ${key}.` };
  }

  let next = state;
  let note = "";

  if (cell.kind === "empty") {
    const cells = {
      ...target.board.cells,
      [key]: { kind: "built" as const, builtBy: actorId },
    };
    next = replacePlayerBoard(next, targetOwnerId, {
      ...getPlayer(next, targetOwnerId).board,
      cells,
    });
    note = `Master: placed ${column} L${placeLevel} on ${targetOwnerId}.`;
  } else {
    note = `Master: ${column} L${placeLevel} already built — applied rank-up special only.`;
  }

  // Unblock: clear blocked flag on this column/level if present
  const blockedKey = `${column}:${placeLevel}`;
  if (next.blockedCells[blockedKey]) {
    const { [blockedKey]: _removed, ...rest } = next.blockedCells;
    next = { ...next, blockedCells: rest };
    note += " Unblocked level.";
  }

  if (effective > 5) {
    const mult = overLevel5Multiplier(effective);
    const base = getBuildMoneyPayout(columnIdToIndex(column), 5);
    const bonus = base * mult;
    let funded = next;
    if (funded.bankBalance < bonus) {
      funded = { ...funded, bankBalance: bonus };
    }
    const paid = bankPayToPlayer(funded, actorId, bonus, "pay-available");
    next = {
      ...paid.state,
      overLevel5BonusActive: {
        playerId: actorId,
        column,
        multiplier: mult,
        expiresAfterTurnOf: actorId,
      },
    };
    note += ` Over-L5 bonus ×${mult}: +${paid.paid} cash (1 turn).`;
  }

  // Client: rank-up on another board → 20%/30%/40% of build cost (by +2/+3/+4)
  if (actorId !== targetOwnerId) {
    const pct = rankUp <= 2 ? 0.2 : rankUp === 3 ? 0.3 : 0.4;
    const buildCost = getBuildCost(columnIdToIndex(column), placeLevel);
    const share = Math.floor(buildCost * pct);
    if (share > 0) {
      let funded = next;
      if (funded.bankBalance < share) {
        funded = { ...funded, bankBalance: share };
      }
      const paid = bankPayToPlayer(funded, actorId, share, "pay-available");
      next = paid.state;
      note += ` Opponent-board Master: +${paid.paid} (${pct * 100}% of cost ${buildCost}).`;
    }
  }

  return { ok: true, state: next, note };
}

/**
 * Hammer: rank down — remove builds from the top of the column down by rankDown steps.
 * If resulting "level" would go under 0 → lose 1 life.
 * Negative depth: pay L1 cost × depth to Bank.
 */
export function applyColumnHammer(
  state: MatchState,
  actorId: PlayerId,
  targetOwnerId: PlayerId,
  column: ColumnId,
  rankDown: number,
): ColumnCardActionResult {
  const target = getPlayer(state, targetOwnerId);
  const builtLevels: Level[] = [];
  for (let level = 5; level >= 1; level -= 1) {
    const cell = target.board.cells[cellKey(column, level as Level)];
    if (cell?.kind === "built") builtLevels.push(level as Level);
  }

  let next = state;
  let removed = 0;
  const toRemove = Math.min(rankDown, builtLevels.length);
  let cells = { ...target.board.cells };

  for (let i = 0; i < toRemove; i += 1) {
    const level = builtLevels[i]!;
    cells[cellKey(column, level)] = { kind: "empty" };
    removed += 1;
  }

  next = replacePlayerBoard(next, targetOwnerId, {
    ...getPlayer(next, targetOwnerId).board,
    cells,
  });

  const underflow = rankDown - builtLevels.length;
  let note = `Hammer: removed ${removed} build(s) on ${targetOwnerId} ${column}.`;

  if (underflow > 0) {
    // Client: board owner loses 1 life; board owner pays negative-build fee
    const owner = getPlayer(next, targetOwnerId);
    const depth = Math.min(underflow, 2);
    const cost = getBuildCost(columnIdToIndex(column), 1) * depth;
    if (owner.cash < cost) {
      return {
        ok: false,
        state,
        reason: `Board owner ${targetOwnerId} cannot pay Hammer fee ${cost} (has ${owner.cash}).`,
      };
    }
    next = {
      ...next,
      players: next.players.map((p) =>
        p.id === targetOwnerId
          ? { ...p, lives: p.lives - 1, cash: p.cash - cost }
          : p,
      ),
    };
    next = bankReceivePayment(next, cost);
    next = syncKnockoutsFromLives(next);
    note += ` Under level 0: ${targetOwnerId} loses 1 life and pays ${cost} to Bank (L1×${depth}).`;
  }

  return { ok: true, state: next, note };
}

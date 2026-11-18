import {
  COLUMN_IDS,
  LEVELS,
  type ColumnId,
  type Level,
  type PlayerId,
} from "./board";
import {
  emptyBankRecords,
  type PlayerBankRecords,
} from "./bankRecordTypes";
import { getPlayer, type MatchState } from "./match";

export type { PlayerBankRecords };
export { emptyBankRecords };

function patchRecords(
  state: MatchState,
  playerId: PlayerId,
  patch: Partial<PlayerBankRecords> | ((r: PlayerBankRecords) => PlayerBankRecords),
): MatchState {
  return {
    ...state,
    players: state.players.map((p) => {
      if (p.id !== playerId) return p;
      const next =
        typeof patch === "function"
          ? patch(p.bankRecords)
          : { ...p.bankRecords, ...patch };
      return { ...p, bankRecords: next };
    }),
  };
}

/** Record calculating-rate money paid after builds (per column + per level). */
export function recordRateSale(
  state: MatchState,
  playerId: PlayerId,
  column: ColumnId,
  level: Level,
  amount: number,
): MatchState {
  if (amount <= 0) return state;
  return patchRecords(state, playerId, (r) => ({
    ...r,
    columnSales: {
      ...r.columnSales,
      [column]: (r.columnSales[column] ?? 0) + amount,
    },
    levelSales: {
      ...r.levelSales,
      [level]: (r.levelSales[level] ?? 0) + amount,
    },
  }));
}

export function recordBuildForBank(
  state: MatchState,
  playerId: PlayerId,
): MatchState {
  return patchRecords(state, playerId, (r) => ({
    ...r,
    buildsThisTurn: r.buildsThisTurn + 1,
  }));
}

/** End of a player's turn: lock max builds, reset this-turn counter. */
export function flushBuildTurnRecord(
  state: MatchState,
  playerId: PlayerId,
): MatchState {
  return patchRecords(state, playerId, (r) => ({
    ...r,
    maxBuildsInOneTurn: Math.max(r.maxBuildsInOneTurn, r.buildsThisTurn),
    buildsThisTurn: 0,
  }));
}

export function recordRecycleRefund(
  state: MatchState,
  playerId: PlayerId,
  refund: number,
): MatchState {
  if (refund < 0) return state;
  return patchRecords(state, playerId, (r) => ({
    ...r,
    moneyFromRecycle: r.moneyFromRecycle + refund,
    recycleActions: r.recycleActions + 1,
  }));
}

export function recordSpecialCardSpend(
  state: MatchState,
  playerId: PlayerId,
  price: number,
): MatchState {
  if (price <= 0) return state;
  return patchRecords(state, playerId, (r) => ({
    ...r,
    moneySpentOnSpecialCards: r.moneySpentOnSpecialCards + price,
  }));
}

export function bestColumnSales(records: PlayerBankRecords): number {
  return Math.max(0, ...COLUMN_IDS.map((c) => records.columnSales[c] ?? 0));
}

export function bestLevelSales(records: PlayerBankRecords): number {
  return Math.max(0, ...LEVELS.map((l) => records.levelSales[l] ?? 0));
}

export function getBankRecords(
  state: MatchState,
  playerId: PlayerId,
): PlayerBankRecords {
  return getPlayer(state, playerId).bankRecords;
}

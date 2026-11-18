import { M2Assumptions } from "./assumptions";
import { type BoardPosition, type PlayerId } from "./board";
import { resolveBuildCostWithColumnRule } from "./columnLeadership";
import {
  getPlayer,
  type MatchState,
  type PlayerMatchState,
} from "./match";

/**
 * Client cash-flow architecture: five named Bank actions.
 * 1) createBank
 * 2) setupPlayerMoney
 * 3) payBuildCost
 * 4) bankReceivePayment
 * 5) returnMoneyForActiveLevel (orchestrated in levelPayout.ts)
 */

export interface BankState {
  readonly balance: number;
}

export type BankShortfallPolicy = "pay-available" | "fail";

export function createBank(initialBalance = 0): BankState {
  if (initialBalance < 0) {
    throw new Error("Bank balance cannot start negative");
  }
  return { balance: initialBalance };
}

export function withBankBalance(state: MatchState, balance: number): MatchState {
  return { ...state, bankBalance: balance };
}

/**
 * Action 2 — distribute starting cash from assumptions (idempotent if already set).
 * Diagram: Bank → setup money for players (1000 each).
 */
export function setupPlayerMoney(
  state: MatchState,
  amount: number = M2Assumptions.startingCash,
): MatchState {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, cash: amount })),
  };
}

/**
 * Action 4 — credit bank pool.
 */
export function bankReceivePayment(
  state: MatchState,
  amount: number,
): MatchState {
  if (amount < 0) {
    throw new Error("Payment amount cannot be negative");
  }
  return withBankBalance(state, state.bankBalance + amount);
}

/**
 * Debit bank toward player cash. On shortfall: pay what bank has (A6).
 */
export function bankPayToPlayer(
  state: MatchState,
  playerId: PlayerId,
  amount: number,
  policy: BankShortfallPolicy = "pay-available",
): { state: MatchState; paid: number; shortfall: number } {
  if (amount < 0) {
    throw new Error("Payout amount cannot be negative");
  }
  const available = state.bankBalance;
  let paid = amount;
  let shortfall = 0;
  if (amount > available) {
    if (policy === "fail") {
      return { state, paid: 0, shortfall: amount };
    }
    paid = available;
    shortfall = amount - available;
  }
  const player = getPlayer(state, playerId);
  const nextPlayers = state.players.map((p) =>
    p.id === playerId ? { ...p, cash: p.cash + paid } : p,
  );
  return {
    state: {
      ...state,
      bankBalance: state.bankBalance - paid,
      players: nextPlayers,
    },
    paid,
    shortfall,
  };
}

export type PayBuildCostResult =
  | {
      readonly ok: true;
      readonly state: MatchState;
      readonly cost: number;
      readonly note: string;
    }
  | {
      readonly ok: false;
      readonly state: MatchState;
      readonly reason: string;
    };

/**
 * Action 3 — player pays build cost immediately; Action 4 credits bank.
 */
export function payBuildCost(
  state: MatchState,
  actorId: PlayerId,
  position: BoardPosition,
): PayBuildCostResult {
  const priced = resolveBuildCostWithColumnRule(
    state,
    actorId,
    position.column,
    position.level,
  );
  const cost = priced.cost;
  const actor = getPlayer(state, actorId);

  if (
    M2Assumptions.blockBuildIfInsufficientCash &&
    actor.cash < cost
  ) {
    return {
      ok: false,
      state,
      reason: `Insufficient cash: need ${cost}, have ${actor.cash}.`,
    };
  }

  const nextPlayers: PlayerMatchState[] = state.players.map((p) =>
    p.id === actorId ? { ...p, cash: p.cash - cost } : p,
  );
  const afterPay: MatchState = {
    ...state,
    players: nextPlayers,
  };
  const withBank = bankReceivePayment(afterPay, cost);

  return {
    ok: true,
    state: withBank,
    cost,
    note:
      `Paid ${cost} to Bank for ${position.column} L${position.level}.` +
      (priced.columnLeaderDiscount ? ` ${priced.note}` : ""),
  };
}

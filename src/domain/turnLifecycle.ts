import { processBorrowTurn, tickBlockedCells } from "./borrows";
import { applyFigurineHavingReward } from "./figurines";
import { returnMoneyForActiveLevel } from "./levelPayout";
import {
  advanceTurn,
  getActivePlayerId,
  type MatchState,
} from "./match";
import { evaluateMatchOutcomes } from "./winLose";

export interface EndTurnResult {
  readonly state: MatchState;
  readonly payoutNote: string;
  readonly outcomeNote: string;
}

/**
 * End turn:
 * 1) Figurine having reward (pending choice note)
 * 2) Build-borrow installments + scheduled player-borrow repayments
 * 3) Tick blocked-cell auto-unblock
 * 4) Normal + Extra returns for active level
 * 5) Advance player+level
 * 6) Evaluate win/lose
 */
export function endTurnWithPayout(state: MatchState): EndTurnResult {
  const activeId = getActivePlayerId(state);
  const having = applyFigurineHavingReward(state, activeId);
  const havingNote = having.ok ? having.note : having.reason;

  const borrows = processBorrowTurn(having.state);
  const unblocked = tickBlockedCells(borrows.state);

  const payout = returnMoneyForActiveLevel(
    unblocked,
    state.levelTurn.activeLevel,
  );
  const next = advanceTurn(payout.state);
  const outcomes = evaluateMatchOutcomes(next);
  return {
    state: next,
    payoutNote: `${havingNote} ${borrows.note} ${payout.note}`,
    outcomeNote: outcomes.note,
  };
}

import { flushBuildTurnRecord } from "./bankRecords";
import { processBorrowTurn, tickBlockedCells } from "./borrows";
import { applyFigurineHavingReward } from "./figurines";
import { returnMoneyForActiveLevel } from "./levelPayout";
import {
  advanceTurn,
  getActivePlayerId,
  type MatchState,
} from "./match";
import {
  evaluateAllObjectives,
  tickObjectiveSelectWindow,
} from "./objectives";
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
 * 6) Tick objective select window + auto-claim objectives
 * 7) Evaluate win/lose
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
  // Client: track max builds per turn for Loan 4, then start next turn clean
  let next = flushBuildTurnRecord(payout.state, activeId);
  next = advanceTurn(next);
  next = tickObjectiveSelectWindow(next);
  const objectives = evaluateAllObjectives(next);
  next = objectives.state;
  const outcomes = evaluateMatchOutcomes(next);
  const objectiveNote = objectives.notes.length
    ? ` Objectives: ${objectives.notes.join(" ")}`
    : "";
  return {
    state: next,
    payoutNote: `${havingNote} ${borrows.note} ${payout.note}${objectiveNote}`,
    outcomeNote: outcomes.note,
  };
}
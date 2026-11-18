import { M2Assumptions } from "./assumptions";
import { bankPayToPlayer, bankReceivePayment } from "./bank";
import {
  cellKey,
  columnIdToIndex,
  type BoardPosition,
  type PlayerId,
} from "./board";
import type {
  BoardBuildAdvantage,
  BorrowRateOption,
  BuildBorrow,
  PlayerBorrow,
} from "./borrowTypes";
import { getBuildCost, getBuildMoneyPayout } from "./economy";
import { getPlayer, type MatchState } from "./match";

export type {
  BoardBuildAdvantage,
  BorrowRateOption,
  BuildBorrow,
  PlayerBorrow,
} from "./borrowTypes";

export type BorrowActionResult =
  | { readonly ok: true; readonly state: MatchState; readonly note: string }
  | { readonly ok: false; readonly state: MatchState; readonly reason: string };

function maxNonBankBorrows(state: MatchState): number {
  if (state.cards.decks.unlocked[3]) return 7;
  if (state.cards.decks.unlocked[2]) return 5;
  return 3;
}

function countPlayerNonBankBorrows(state: MatchState, playerId: PlayerId): number {
  return (
    state.buildBorrows.filter((b) => b.borrowerId === playerId).length +
    state.playerBorrows.filter((b) => b.borrowerId === playerId).length
  );
}

/** Default (higher) rate and optional lower rate unlocked by paying a fee. */
export function ratesForBorrowOrdinal(ordinal: number): {
  readonly defaultRate: BorrowRateOption;
  readonly lowerRate: BorrowRateOption | null;
} {
  if (ordinal <= 3) return { defaultRate: 40, lowerRate: null };
  if (ordinal <= 5) return { defaultRate: 50, lowerRate: 30 };
  return { defaultRate: 60, lowerRate: 40 };
}

/** @deprecated use ratesForBorrowOrdinal — kept for older tests */
export function rateOptionsForBorrowOrdinal(
  ordinal: number,
): readonly BorrowRateOption[] {
  const r = ratesForBorrowOrdinal(ordinal);
  return r.lowerRate ? [r.defaultRate, r.lowerRate] : [r.defaultRate];
}

export function listBorrowCapacity(
  state: MatchState,
  playerId: PlayerId,
): {
  readonly used: number;
  readonly max: number;
  readonly nextOrdinal: number;
  readonly defaultRate: BorrowRateOption;
  readonly lowerRate: BorrowRateOption | null;
  readonly lowerRateUnlockFeePct: number;
  readonly lowerRateUnlockFee: number;
} {
  const used = countPlayerNonBankBorrows(state, playerId);
  const max = maxNonBankBorrows(state);
  const nextOrdinal = used + 1;
  const rates = ratesForBorrowOrdinal(nextOrdinal);
  const unlockFeePct =
    nextOrdinal <= 3 ? 0.2 : nextOrdinal <= 5 ? 0.3 : 0.4;
  return {
    used,
    max,
    nextOrdinal,
    defaultRate: rates.defaultRate,
    lowerRate: rates.lowerRate,
    /** Display hint: fee = this fraction × principal when unlocking lower rate. */
    lowerRateUnlockFeePct: unlockFeePct,
    lowerRateUnlockFee: M2Assumptions.lowerBorrowRateUnlockFee,
  };
}

export function takeBuildBorrow(
  state: MatchState,
  borrowerId: PlayerId,
  position: BoardPosition,
): BorrowActionResult {
  const cap = listBorrowCapacity(state, borrowerId);
  if (cap.used >= cap.max) {
    return {
      ok: false,
      state,
      reason: `Borrow cap reached (${cap.used}/${cap.max}). Unlock higher decks for more.`,
    };
  }

  const cost = getBuildCost(columnIdToIndex(position.column), position.level);
  let funded = state;
  if (funded.bankBalance < cost) {
    funded = { ...funded, bankBalance: cost };
  }
  const paid = bankPayToPlayer(funded, borrowerId, cost, "pay-available");
  if (paid.paid < cost) {
    return { ok: false, state, reason: "Bank could not fund build borrow." };
  }

  const id = `bb-${state.turnIndex}-${borrowerId}-${state.buildBorrows.length}`;
  return {
    ok: true,
    state: {
      ...paid.state,
      buildBorrows: [
        ...state.buildBorrows,
        { id, borrowerId, position, buildCost: cost, paid: 0 },
      ],
    },
    note: `Build borrow ${cost} for ${position.column} L${position.level} (${cap.nextOrdinal}/${cap.max}). Repay ${M2Assumptions.buildBorrowPercentPerTurn * 100}% of cost each turn.`,
  };
}

/**
 * Type 1 — cash borrow: +40% total on #1–3; #4–7 default higher rate,
 * pay fee to unlock lower rate (cannot freely choose).
 */
export function takePlayerBorrow(
  state: MatchState,
  borrowerId: PlayerId,
  lenderId: PlayerId,
  principal: number,
  deliverAtTurnIndex: number | null,
  options?: { readonly unlockLowerRate?: boolean },
): BorrowActionResult {
  if (borrowerId === lenderId) {
    return { ok: false, state, reason: "Cannot borrow from yourself." };
  }
  if (principal <= 0) {
    return { ok: false, state, reason: "Principal must be positive." };
  }

  const cap = listBorrowCapacity(state, borrowerId);
  if (cap.used >= cap.max) {
    return {
      ok: false,
      state,
      reason: `Borrow cap reached (${cap.used}/${cap.max}).`,
    };
  }

  const wantLower = options?.unlockLowerRate === true;
  if (wantLower && cap.lowerRate === null) {
    return {
      ok: false,
      state,
      reason: "No lower rate available for this borrow band (1–3 is fixed 40%).",
    };
  }

  const premiumPercent: BorrowRateOption = wantLower
    ? cap.lowerRate!
    : cap.defaultRate;
  // Client: 20%/30%/40% out of the cost — use % of principal by band when unlocking lower rate
  const unlockFeePct =
    cap.nextOrdinal <= 3 ? 0.2 : cap.nextOrdinal <= 5 ? 0.3 : 0.4;
  const unlockFee = wantLower
    ? Math.floor(principal * unlockFeePct)
    : 0;

  const lender = getPlayer(state, lenderId);
  const borrower = getPlayer(state, borrowerId);
  if (lender.cash < principal) {
    return {
      ok: false,
      state,
      reason: `Lender has ${lender.cash}; need ${principal}.`,
    };
  }
  if (wantLower && borrower.cash < unlockFee) {
    return {
      ok: false,
      state,
      reason: `Need ${unlockFee} to unlock lower rate; have ${borrower.cash}.`,
    };
  }

  let nextPlayers = state.players.map((p) => {
    if (p.id === lenderId) {
      return {
        ...p,
        cash: p.cash - principal,
        playerBorrowOffersAccepted: p.playerBorrowOffersAccepted + 1,
      };
    }
    if (p.id === borrowerId) {
      return {
        ...p,
        cash: p.cash + principal - unlockFee,
      };
    }
    return p;
  });

  let next: MatchState = { ...state, players: nextPlayers };
  if (unlockFee > 0) {
    next = bankReceivePayment(next, unlockFee);
  }

  const id = `pb-${state.turnIndex}-${borrowerId}-${state.playerBorrows.length}`;
  return {
    ok: true,
    state: {
      ...next,
      playerBorrows: [
        ...state.playerBorrows,
        {
          id,
          borrowerId,
          lenderId,
          principal,
          premiumPercent,
          deliverAtTurnIndex,
          borrowOrdinal: cap.nextOrdinal,
          usedLowerRate: wantLower,
        },
      ],
    },
    note:
      `Player borrow ${principal} from ${lenderId} at +${premiumPercent}%` +
      (wantLower ? ` (paid ${unlockFee} for lower rate)` : ` (default rate)`) +
      ` — borrow #${cap.nextOrdinal}/${cap.max}.`,
  };
}

/**
 * Type 2 — board owner allows another player to build on their board.
 * Owner later receives 20% calculating-rate advantage each turn while that build stands.
 */
export function grantBoardBuildPermit(
  state: MatchState,
  boardOwnerId: PlayerId,
  builderId: PlayerId,
): BorrowActionResult {
  if (boardOwnerId === builderId) {
    return { ok: false, state, reason: "Cannot grant permit to yourself." };
  }
  const nextPlayers = state.players.map((p) =>
    p.id === builderId ? { ...p, canBuildOnOpponent: true } : p,
  );
  return {
    ok: true,
    state: { ...state, players: nextPlayers },
    note: `${boardOwnerId} allows ${builderId} to build on their board (20%/turn advantage while build stands).`,
  };
}

/** Register advantage tracking after an opponent build is placed. */
export function registerBoardBuildAdvantage(
  state: MatchState,
  boardOwnerId: PlayerId,
  builderId: PlayerId,
  position: BoardPosition,
): MatchState {
  if (boardOwnerId === builderId) return state;
  const entry: BoardBuildAdvantage = {
    boardOwnerId,
    builderId,
    position,
  };
  const exists = state.boardBuildAdvantages.some(
    (a) =>
      a.boardOwnerId === boardOwnerId &&
      a.builderId === builderId &&
      a.position.column === position.column &&
      a.position.level === position.level,
  );
  if (exists) return state;
  return {
    ...state,
    boardBuildAdvantages: [...state.boardBuildAdvantages, entry],
  };
}

export function schedulePlayerBorrowRepayment(
  state: MatchState,
  borrowId: string,
  borrowerId: PlayerId,
  deliverAtTurnIndex: number,
): BorrowActionResult {
  const borrow = state.playerBorrows.find(
    (b) => b.id === borrowId && b.borrowerId === borrowerId,
  );
  if (!borrow) {
    return { ok: false, state, reason: "Borrow not found." };
  }
  if (deliverAtTurnIndex < state.turnIndex) {
    return { ok: false, state, reason: "Deliver turn must be now or later." };
  }
  return {
    ok: true,
    state: {
      ...state,
      playerBorrows: state.playerBorrows.map((b) =>
        b.id === borrowId ? { ...b, deliverAtTurnIndex } : b,
      ),
    },
    note: `Scheduled repay of ${borrowId} at turn ${deliverAtTurnIndex}.`,
  };
}

export function repayPlayerBorrow(
  state: MatchState,
  borrowId: string,
): BorrowActionResult {
  const borrow = state.playerBorrows.find((b) => b.id === borrowId);
  if (!borrow) {
    return { ok: false, state, reason: "Borrow not found." };
  }
  const due = Math.floor(borrow.principal * (1 + borrow.premiumPercent / 100));
  const borrower = getPlayer(state, borrow.borrowerId);
  if (borrower.cash < due) {
    return {
      ok: false,
      state,
      reason: `Need ${due} to repay; have ${borrower.cash}.`,
    };
  }
  const nextPlayers = state.players.map((p) => {
    if (p.id === borrow.borrowerId) return { ...p, cash: p.cash - due };
    if (p.id === borrow.lenderId) return { ...p, cash: p.cash + due };
    return p;
  });
  return {
    ok: true,
    state: {
      ...state,
      players: nextPlayers,
      playerBorrows: state.playerBorrows.filter((b) => b.id !== borrowId),
    },
    note: `Repaid ${due} to ${borrow.lenderId} (principal ${borrow.principal} + ${borrow.premiumPercent}%).`,
  };
}

function payBoardBuildAdvantages(state: MatchState): {
  state: MatchState;
  note: string;
} {
  let next = state;
  const kept: BoardBuildAdvantage[] = [];
  const notes: string[] = [];
  const pct = M2Assumptions.boardBuildAdvantagePercentPerTurn;

  for (const adv of state.boardBuildAdvantages) {
    const owner = getPlayer(next, adv.boardOwnerId);
    const key = cellKey(adv.position.column, adv.position.level);
    const cell = owner.board.cells[key];
    if (!cell || cell.kind !== "built" || cell.builtBy !== adv.builderId) {
      notes.push(
        `Advantage ${adv.position.column} L${adv.position.level} ended (build gone).`,
      );
      continue;
    }
    kept.push(adv);
    const rate = getBuildMoneyPayout(
      columnIdToIndex(adv.position.column),
      adv.position.level,
    );
    const amount = Math.floor(rate * pct);
    if (amount <= 0) continue;
    let funded = next;
    if (funded.bankBalance < amount) {
      funded = { ...funded, bankBalance: amount };
    }
    const paid = bankPayToPlayer(
      funded,
      adv.boardOwnerId,
      amount,
      "pay-available",
    );
    next = paid.state;
    notes.push(
      `Board advantage +${paid.paid} to ${adv.boardOwnerId} (${pct * 100}% of rate ${rate}).`,
    );
  }

  return {
    state: { ...next, boardBuildAdvantages: kept },
    note: notes.length ? notes.join(" ") : "",
  };
}

export function processBorrowTurn(state: MatchState): {
  state: MatchState;
  note: string;
} {
  let next: MatchState = { ...state, turnIndex: state.turnIndex + 1 };
  const notes: string[] = [];
  const pct = M2Assumptions.buildBorrowPercentPerTurn;
  const remainingBuilds: BuildBorrow[] = [];

  for (const b of next.buildBorrows) {
    const installment = Math.floor(b.buildCost * pct);
    const borrower = getPlayer(next, b.borrowerId);
    const pay = Math.min(installment, borrower.cash);
    if (pay > 0) {
      next = {
        ...next,
        players: next.players.map((p) =>
          p.id === b.borrowerId ? { ...p, cash: p.cash - pay } : p,
        ),
      };
      next = bankReceivePayment(next, pay);
    }
    const paidTotal = b.paid + pay;
    if (paidTotal >= b.buildCost) {
      notes.push(`Build borrow ${b.id} cleared.`);
    } else {
      remainingBuilds.push({ ...b, paid: paidTotal });
      notes.push(
        `Build borrow ${b.id}: paid ${pay} (total ${paidTotal}/${b.buildCost}).`,
      );
    }
  }
  next = { ...next, buildBorrows: remainingBuilds };

  const adv = payBoardBuildAdvantages(next);
  next = adv.state;
  if (adv.note) notes.push(adv.note);

  for (const b of [...next.playerBorrows]) {
    if (
      b.deliverAtTurnIndex !== null &&
      b.deliverAtTurnIndex <= next.turnIndex
    ) {
      const repaid = repayPlayerBorrow(next, b.id);
      if (repaid.ok) {
        next = repaid.state;
        notes.push(repaid.note);
      } else {
        notes.push(`Due ${b.id} unpaid: ${repaid.reason}`);
      }
    }
  }

  return {
    state: next,
    note: notes.length ? notes.join(" ") : "No borrow payments due.",
  };
}

/**
 * Tick blocked cells. Client: normally 2 turns; depends on how many players block.
 * Duration for a cell = baseTurns × distinct blockers currently active in the match.
 */
export function tickBlockedCells(state: MatchState): MatchState {
  const next: Record<string, { blockedBy: PlayerId; turnsRemaining: number }> =
    {};
  for (const [key, cell] of Object.entries(state.blockedCells)) {
    const remaining = cell.turnsRemaining - 1;
    if (remaining > 0) {
      next[key] = { blockedBy: cell.blockedBy, turnsRemaining: remaining };
    }
  }
  return { ...state, blockedCells: next };
}

/** Apply a new block; turns scale with distinct blockers (min base 2). */
export function blockCell(
  state: MatchState,
  cellKeyStr: string,
  blockedBy: PlayerId,
): MatchState {
  const blockers = new Set<PlayerId>(
    Object.values(state.blockedCells).map((c) => c.blockedBy),
  );
  blockers.add(blockedBy);
  const turns =
    M2Assumptions.blockedCellAutoUnblockTurns * Math.max(1, blockers.size);
  return {
    ...state,
    blockedCells: {
      ...state.blockedCells,
      [cellKeyStr]: { blockedBy, turnsRemaining: turns },
    },
  };
}

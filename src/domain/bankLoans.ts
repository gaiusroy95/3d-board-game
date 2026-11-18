import { bankPayToPlayer, bankReceivePayment } from "./bank";
import type { PlayerId } from "./board";
import { getPlayer, type ActiveLoan, type MatchState } from "./match";
import {
  bestColumnSales,
  bestLevelSales,
} from "./bankRecords";
import {
  moneyMadeWithoutSpecials,
  recordMoneyFromBorrows,
  totalCashMade,
} from "./objectives";

export type { ActiveLoan };

/**
 * Bank loan offers (client 5 buttons). Undefined terms (advantage, etc.)
 * are config zeros until the client defines them — offers still show math.
 */

export interface LoanOffer {
  readonly button: 1 | 2 | 3 | 4 | 5;
  readonly label: string;
  readonly principal: number;
  readonly repaymentPremiumPercent: number;
  readonly enabled: boolean;
  readonly disabledReason: string | null;
  readonly formulaNote: string;
}

export type LoanActionResult =
  | { readonly ok: true; readonly state: MatchState; readonly note: string }
  | { readonly ok: false; readonly state: MatchState; readonly reason: string };

function countLevel4Builds(state: MatchState, playerId: PlayerId): number {
  const player = getPlayer(state, playerId);
  let count = 0;
  for (const [key, cell] of Object.entries(player.board.cells)) {
    if (cell.kind !== "built") continue;
    if (key.endsWith(":4")) count += 1;
  }
  return count;
}

function countSkillsBought(state: MatchState, playerId: PlayerId): number {
  const player = getPlayer(state, playerId);
  let n = 0;
  for (const s of player.figurineSkills) {
    if (s.skill1Learned) n += 1;
    if (s.skill2Learned) n += 1;
  }
  return n;
}

/**
 * Compute the five loan offers from bank record lists.
 * Loan 1: best column sales (calculating-rate money).
 * Loan 2: best level sales + money made (borrows/skills/rate).
 * Loan 3: 4200 start; quantum 0.5 on recycle money + lives.
 * Loan 4: figurines×5600 + maxBuildsInOneTurn×5600 (added).
 * Loan 5: 7000 unit on skills / cash / points.
 */
export function listLoanOffers(
  state: MatchState,
  playerId: PlayerId,
): readonly LoanOffer[] {
  const player = getPlayer(state, playerId);
  const records = player.bankRecords;
  const columnBest = bestColumnSales(records);
  const levelBest = bestLevelSales(records);
  const moneyMade = moneyMadeWithoutSpecials(state, playerId);
  const moneyFromRecycle = records.moneyFromRecycle;
  const moneySpentSpecialCards = records.moneySpentOnSpecialCards;
  const maxBuilds = records.maxBuildsInOneTurn;
  const skillsUsed = player.objectiveStats.skillsUsed;
  const cashMade = totalCashMade(state, playerId);
  const pointsGained = Math.max(0, player.objectivePoints);

  // Loan 3 recycle term: quantum 0.5 × money made from recycle (30% card refunds)
  const b1 = 1500 + 0.4 * columnBest;
  const b2 = 2800 + 0.4 * levelBest + 0.4 * moneyMade;
  const b3 =
    4200 +
    0.5 * moneyFromRecycle +
    0.3 * moneySpentSpecialCards +
    0.5 * player.lives * 4200;
  const b4 =
    player.ownedFigurines * 5600 + maxBuilds * 5600;
  // Client: Borrow 5 starts at 7000
  const b5 =
    7000 +
    countSkillsBought(state, playerId) * 7000 +
    0.5 * skillsUsed * 7000 +
    0.25 * cashMade +
    0.5 * pointsGained * 7000;

  const lvl4 = countLevel4Builds(state, playerId);

  return [
    {
      button: 1,
      label: "Loan 1",
      principal: Math.floor(b1),
      repaymentPremiumPercent: 0,
      enabled: true,
      disabledReason: null,
      formulaNote: `1500 + 0.4×best column sales(${columnBest})`,
    },
    {
      button: 2,
      label: "Loan 2",
      principal: Math.floor(b2),
      repaymentPremiumPercent: 25,
      enabled: true,
      disabledReason: null,
      formulaNote: `2800 + 0.4×best level(${levelBest}) + 0.4×money made(${moneyMade})`,
    },
    {
      button: 3,
      label: "Loan 3",
      principal: Math.floor(b3),
      repaymentPremiumPercent: 50,
      enabled: state.recycleUses >= 1,
      disabledReason:
        state.recycleUses >= 1 ? null : "Requires recycle used at least once.",
      formulaNote: `4200 + 0.5×recycle money(${moneyFromRecycle}) + 0.3×card spend + 0.5×lives×4200`,
    },
    {
      button: 4,
      label: "Loan 4",
      principal: Math.floor(b4),
      repaymentPremiumPercent: 75,
      enabled: lvl4 >= 3,
      disabledReason: lvl4 >= 3 ? null : "Requires 3× Level-4 builds (lvl4*3).",
      formulaNote: `figurines×5600 + max builds/turn(${maxBuilds})×5600`,
    },
    {
      button: 5,
      label: "Loan 5",
      principal: Math.floor(b5),
      repaymentPremiumPercent: 100,
      enabled: state.playersKnockedOut >= 1,
      disabledReason:
        state.playersKnockedOut >= 1 ? null : "Requires knock out 1 player.",
      formulaNote: `7000 start + skills bought/used×7000 + 0.25×cash made(${cashMade}) + points`,
    },
  ];
}

export function takeLoan(
  state: MatchState,
  playerId: PlayerId,
  button: 1 | 2 | 3 | 4 | 5,
): LoanActionResult {
  const borrower = getPlayer(state, playerId);
  // Client: "Only 1 burrow from bank"
  if (borrower.bankBorrowsUsed >= 1 || state.activeLoans.some((l) => l.borrowerId === playerId)) {
    return {
      ok: false,
      state,
      reason: "Only 1 borrow from Bank is allowed per player.",
    };
  }

  const offer = listLoanOffers(state, playerId).find((o) => o.button === button);
  if (!offer) {
    return { ok: false, state, reason: "Unknown loan button." };
  }
  if (!offer.enabled) {
    return {
      ok: false,
      state,
      reason: offer.disabledReason ?? "Loan locked.",
    };
  }
  if (offer.principal <= 0) {
    return { ok: false, state, reason: "Loan principal is 0." };
  }

  const repaymentDue = Math.floor(
    offer.principal * (1 + offer.repaymentPremiumPercent / 100),
  );

  // Seed bank if needed so loans can pay out in prototype (ASSUMPTION: bank can fund loans).
  let funded = state;
  if (state.bankBalance < offer.principal) {
    funded = {
      ...state,
      bankBalance: offer.principal,
    };
  }

  const paid = bankPayToPlayer(funded, playerId, offer.principal, "pay-available");
  if (paid.paid < offer.principal) {
    return {
      ok: false,
      state,
      reason: `Bank shortfall: needed ${offer.principal}.`,
    };
  }

  const next: MatchState = {
    ...paid.state,
    players: paid.state.players.map((p) =>
      p.id === playerId
        ? {
            ...p,
            bankBorrowsUsed: p.bankBorrowsUsed + 1,
            bankBorrowCashTotal: p.bankBorrowCashTotal + offer.principal,
          }
        : p,
    ),
    activeLoans: [
      ...state.activeLoans,
      {
        button,
        principal: offer.principal,
        repaymentDue,
        borrowerId: playerId,
      },
    ],
  };

  return {
    ok: true,
    state: recordMoneyFromBorrows(next, playerId, offer.principal),
    note: `Borrowed ${offer.principal} from Bank (button ${button}); repay ${repaymentDue}. (1 bank borrow used.)`,
  };
}

export function repayLoan(
  state: MatchState,
  playerId: PlayerId,
  button: 1 | 2 | 3 | 4 | 5,
): LoanActionResult {
  const loan = state.activeLoans.find(
    (l) => l.borrowerId === playerId && l.button === button,
  );
  if (!loan) {
    return { ok: false, state, reason: "No active loan for that button." };
  }
  const player = getPlayer(state, playerId);
  if (player.cash < loan.repaymentDue) {
    return {
      ok: false,
      state,
      reason: `Need ${loan.repaymentDue} to repay; have ${player.cash}.`,
    };
  }
  const nextPlayers = state.players.map((p) =>
    p.id === playerId ? { ...p, cash: p.cash - loan.repaymentDue } : p,
  );
  const afterPay = bankReceivePayment(
    { ...state, players: nextPlayers },
    loan.repaymentDue,
  );
  return {
    ok: true,
    state: {
      ...afterPay,
      activeLoans: state.activeLoans.filter(
        (l) => !(l.borrowerId === playerId && l.button === button),
      ),
    },
    note: `Repaid loan button ${button}: ${loan.repaymentDue}.`,
  };
}

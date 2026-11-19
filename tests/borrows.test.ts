import { describe, expect, it } from "vitest";
import {
  countActiveCashBorrows,
  listBorrowCapacity,
  rateOptionsForBorrowOrdinal,
  ratesForActiveCashBorrowCount,
  repayPlayerBorrow,
  takeBuildBorrow,
  takePlayerBorrow,
} from "@domain/borrows";
import { createFourPlayerMatch, type MatchState } from "@domain/match";

function baseMatch(): MatchState {
  return createFourPlayerMatch({
    matchId: "b",
    players: [
      { id: "p1", displayName: "A" },
      { id: "p2", displayName: "B" },
      { id: "p3", displayName: "C" },
      { id: "p4", displayName: "D" },
    ],
  });
}

function withDeck2(match: MatchState): MatchState {
  return {
    ...match,
    cards: {
      ...match.cards,
      decks: {
        ...match.cards.decks,
        unlocked: { 1: true, 2: true, 3: false },
      },
    },
  };
}

function withDeck3(match: MatchState): MatchState {
  return {
    ...match,
    cards: {
      ...match.cards,
      decks: {
        ...match.cards.decks,
        unlocked: { 1: true, 2: true, 3: true },
      },
    },
  };
}

function richLender(match: MatchState, cash = 50_000): MatchState {
  return {
    ...match,
    players: match.players.map((p) =>
      p.id === "p2" ? { ...p, cash } : p.id === "p1" ? { ...p, cash: 20_000 } : p,
    ),
  };
}

describe("non-bank borrows", () => {
  it("caps at 3 until higher decks unlock", () => {
    const match = baseMatch();
    expect(listBorrowCapacity(match, "p1").max).toBe(3);
    expect(listBorrowCapacity(withDeck2(match), "p1").max).toBe(5);
    expect(listBorrowCapacity(withDeck3(match), "p1").max).toBe(7);
  });

  it("rates from active count: ≤3 → 40; >3 → 50/30; >5 → 60/40", () => {
    expect(ratesForActiveCashBorrowCount(0)).toEqual({
      defaultRate: 40,
      lowerRate: null,
    });
    expect(ratesForActiveCashBorrowCount(2)).toEqual({
      defaultRate: 40,
      lowerRate: null,
    });
    // 3 active → new is 4th → >3
    expect(ratesForActiveCashBorrowCount(3)).toEqual({
      defaultRate: 50,
      lowerRate: 30,
    });
    expect(ratesForActiveCashBorrowCount(4)).toEqual({
      defaultRate: 50,
      lowerRate: 30,
    });
    // 5 active → new is 6th → >5
    expect(ratesForActiveCashBorrowCount(5)).toEqual({
      defaultRate: 60,
      lowerRate: 40,
    });
    expect(rateOptionsForBorrowOrdinal(4)).toEqual([50, 30]);
    expect(rateOptionsForBorrowOrdinal(7)).toEqual([60, 40]);
  });

  it("takeBuildBorrow funds cash and records debt", () => {
    const result = takeBuildBorrow(baseMatch(), "p1", {
      column: "wine",
      level: 1,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0]!.cash).toBe(1000 + 200);
    expect(result.state.buildBorrows).toHaveLength(1);
  });

  it("player borrow moves cash lender → borrower at +40% when few active", () => {
    const match = richLender(baseMatch());
    const result = takePlayerBorrow(match, "p1", "p2", 500, null);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players.find((p) => p.id === "p1")!.cash).toBe(20_500);
    expect(result.state.players.find((p) => p.id === "p2")!.cash).toBe(49_500);
    expect(result.state.playerBorrows[0]!.premiumPercent).toBe(40);
    expect(countActiveCashBorrows(result.state, "p1")).toBe(1);
  });

  it("4th active cash borrow uses +50% (or +30% with fee)", () => {
    let match = richLender(withDeck2(baseMatch()));
    for (let i = 0; i < 3; i++) {
      const r = takePlayerBorrow(match, "p1", "p2", 100, null);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      match = r.state;
    }
    expect(countActiveCashBorrows(match, "p1")).toBe(3);
    expect(listBorrowCapacity(match, "p1").defaultRate).toBe(50);
    expect(listBorrowCapacity(match, "p1").lowerRate).toBe(30);

    const fourth = takePlayerBorrow(match, "p1", "p2", 1000, null);
    expect(fourth.ok).toBe(true);
    if (!fourth.ok) return;
    expect(fourth.state.playerBorrows[3]!.premiumPercent).toBe(50);

    const fourthLow = takePlayerBorrow(match, "p1", "p2", 1000, null, {
      unlockLowerRate: true,
    });
    expect(fourthLow.ok).toBe(true);
    if (!fourthLow.ok) return;
    expect(fourthLow.state.playerBorrows[3]!.premiumPercent).toBe(30);
  });

  it("6th active cash borrow uses +60% (or +40%)", () => {
    let match = richLender(withDeck3(baseMatch()));
    for (let i = 0; i < 5; i++) {
      const r = takePlayerBorrow(match, "p1", "p2", 100, null);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      match = r.state;
    }
    expect(listBorrowCapacity(match, "p1").defaultRate).toBe(60);
    expect(listBorrowCapacity(match, "p1").lowerRate).toBe(40);
    const sixth = takePlayerBorrow(match, "p1", "p2", 100, null);
    expect(sixth.ok).toBe(true);
    if (!sixth.ok) return;
    expect(sixth.state.playerBorrows[5]!.premiumPercent).toBe(60);
  });

  it("paying back lowers active count and can return rate to 40%", () => {
    let match = richLender(withDeck2(baseMatch()));
    for (let i = 0; i < 4; i++) {
      const r = takePlayerBorrow(match, "p1", "p2", 100, null);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      match = r.state;
    }
    expect(countActiveCashBorrows(match, "p1")).toBe(4);
    // 4 active → next would be 5th → still 50%
    expect(listBorrowCapacity(match, "p1").defaultRate).toBe(50);

    // Repay one → active 3 → next would be 4th → still 50%
    const repayOne = (state: MatchState) => {
      const loan = state.playerBorrows[0]!;
      const due = Math.floor(
        loan.principal * (1 + loan.premiumPercent / 100),
      );
      const funded = {
        ...state,
        players: state.players.map((p) =>
          p.id === "p1" ? { ...p, cash: p.cash + due } : p,
        ),
      };
      return repayPlayerBorrow(funded, loan.id);
    };

    let repaid = repayOne(match);
    expect(repaid.ok).toBe(true);
    if (!repaid.ok) return;
    expect(countActiveCashBorrows(repaid.state, "p1")).toBe(3);
    expect(listBorrowCapacity(repaid.state, "p1").defaultRate).toBe(50);

    // Repay again → active 2 → next would be 3rd → 40%
    repaid = repayOne(repaid.state);
    expect(repaid.ok).toBe(true);
    if (!repaid.ok) return;
    expect(countActiveCashBorrows(repaid.state, "p1")).toBe(2);
    expect(listBorrowCapacity(repaid.state, "p1").defaultRate).toBe(40);
    expect(listBorrowCapacity(repaid.state, "p1").lowerRate).toBeNull();
  });

  it("repay amount is principal + income percent", () => {
    let match = richLender(baseMatch());
    const borrowed = takePlayerBorrow(match, "p1", "p2", 1000, null);
    expect(borrowed.ok).toBe(true);
    if (!borrowed.ok) return;
    const loan = borrowed.state.playerBorrows[0]!;
    expect(loan.premiumPercent).toBe(40);
    const due = Math.floor(1000 * 1.4);
    match = {
      ...borrowed.state,
      players: borrowed.state.players.map((p) =>
        p.id === "p1" ? { ...p, cash: due + 100 } : p,
      ),
    };
    const repaid = repayPlayerBorrow(match, loan.id);
    expect(repaid.ok).toBe(true);
    if (!repaid.ok) return;
    expect(repaid.state.playerBorrows).toHaveLength(0);
    expect(repaid.state.players.find((p) => p.id === "p2")!.cash).toBe(
      50_000 - 1000 + due,
    );
  });
});

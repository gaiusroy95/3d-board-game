import { describe, expect, it } from "vitest";
import {
  listBorrowCapacity,
  rateOptionsForBorrowOrdinal,
  takeBuildBorrow,
  takePlayerBorrow,
} from "@domain/borrows";
import { createFourPlayerMatch } from "@domain/match";

describe("non-bank borrows", () => {
  it("caps at 3 until higher decks unlock", () => {
    const match = createFourPlayerMatch({
      matchId: "b",
      players: [
        { id: "p1", displayName: "A" },
        { id: "p2", displayName: "B" },
        { id: "p3", displayName: "C" },
        { id: "p4", displayName: "D" },
      ],
    });
    expect(listBorrowCapacity(match, "p1").max).toBe(3);
    const d2 = {
      ...match,
      cards: {
        ...match.cards,
        decks: { ...match.cards.decks, unlocked: { 1: true, 2: true, 3: false } },
      },
    };
    expect(listBorrowCapacity(d2, "p1").max).toBe(5);
    const d3 = {
      ...d2,
      cards: {
        ...d2.cards,
        decks: { ...d2.cards.decks, unlocked: { 1: true, 2: true, 3: true } },
      },
    };
    expect(listBorrowCapacity(d3, "p1").max).toBe(7);
  });

  it("uses 40%; #4–5 = 50/30; #6–7 = 60/40 (Deck2 unlocks #4–5)", () => {
    expect(rateOptionsForBorrowOrdinal(1)).toEqual([40]);
    expect(rateOptionsForBorrowOrdinal(4)).toEqual([50, 30]);
    expect(rateOptionsForBorrowOrdinal(7)).toEqual([60, 40]);
    expect(listBorrowCapacity(
      createFourPlayerMatch({
        matchId: "r",
        players: [
          { id: "p1", displayName: "A" },
          { id: "p2", displayName: "B" },
          { id: "p3", displayName: "C" },
          { id: "p4", displayName: "D" },
        ],
      }),
      "p1",
    ).defaultRate).toBe(40);
  });

  it("takeBuildBorrow funds cash and records debt", () => {
    const match = createFourPlayerMatch({
      matchId: "b",
      players: [
        { id: "p1", displayName: "A" },
        { id: "p2", displayName: "B" },
        { id: "p3", displayName: "C" },
        { id: "p4", displayName: "D" },
      ],
    });
    const result = takeBuildBorrow(match, "p1", { column: "wine", level: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0]!.cash).toBe(1000 + 200);
    expect(result.state.buildBorrows).toHaveLength(1);
  });

  it("player borrow moves cash lender → borrower", () => {
    let match = createFourPlayerMatch({
      matchId: "b",
      players: [
        { id: "p1", displayName: "A" },
        { id: "p2", displayName: "B" },
        { id: "p3", displayName: "C" },
        { id: "p4", displayName: "D" },
      ],
    });
    match = {
      ...match,
      players: match.players.map((p) =>
        p.id === "p2" ? { ...p, cash: 5000 } : p,
      ),
    };
    const result = takePlayerBorrow(match, "p1", "p2", 500, null);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0]!.cash).toBe(1500);
    expect(result.state.players[1]!.cash).toBe(4500);
    expect(result.state.players[1]!.playerBorrowOffersAccepted).toBe(1);
    expect(result.state.playerBorrows[0]!.premiumPercent).toBe(40);
  });
});

import { describe, expect, it } from "vitest";
import { listLoanOffers, repayLoan, takeLoan } from "@domain/bankLoans";
import { createFourPlayerMatch } from "@domain/match";

describe("M2-7 bank loans", () => {
  it("loan 1 borrows 1500 with 0% premium", () => {
    const match = createFourPlayerMatch({
      matchId: "loan",
      players: [
        { id: "p1", displayName: "A" },
        { id: "p2", displayName: "B" },
        { id: "p3", displayName: "C" },
        { id: "p4", displayName: "D" },
      ],
    });
    const offers = listLoanOffers(match, "p1");
    expect(offers[0]!.principal).toBe(1500);
    expect(offers[0]!.enabled).toBe(true);

    const borrowed = takeLoan(match, "p1", 1);
    expect(borrowed.ok).toBe(true);
    if (!borrowed.ok) return;
    expect(borrowed.state.players[0]!.cash).toBe(2500);
    expect(borrowed.state.activeLoans).toHaveLength(1);
    expect(borrowed.state.activeLoans[0]!.repaymentDue).toBe(1500);

    const repaid = repayLoan(borrowed.state, "p1", 1);
    expect(repaid.ok).toBe(true);
    if (!repaid.ok) return;
    expect(repaid.state.players[0]!.cash).toBe(1000);
    expect(repaid.state.activeLoans).toHaveLength(0);
  });

  it("loan 2 repayment includes +25%", () => {
    const match = createFourPlayerMatch({
      matchId: "loan",
      players: [
        { id: "p1", displayName: "A" },
        { id: "p2", displayName: "B" },
        { id: "p3", displayName: "C" },
        { id: "p4", displayName: "D" },
      ],
    });
    const borrowed = takeLoan(match, "p1", 2);
    expect(borrowed.ok).toBe(true);
    if (!borrowed.ok) return;
    expect(borrowed.state.activeLoans[0]!.principal).toBe(2800);
    expect(borrowed.state.activeLoans[0]!.repaymentDue).toBe(3500);
  });

  it("loan 3 locked until recycle used", () => {
    const match = createFourPlayerMatch({
      matchId: "loan",
      players: [
        { id: "p1", displayName: "A" },
        { id: "p2", displayName: "B" },
        { id: "p3", displayName: "C" },
        { id: "p4", displayName: "D" },
      ],
    });
    expect(listLoanOffers(match, "p1")[2]!.enabled).toBe(false);
    const unlocked = { ...match, recycleUses: 1 };
    expect(listLoanOffers(unlocked, "p1")[2]!.enabled).toBe(true);
  });

  it("loan 1 uses best column sales × 0.4", () => {
    let match = createFourPlayerMatch({
      matchId: "loan",
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
        p.id === "p1"
          ? {
              ...p,
              bankRecords: {
                ...p.bankRecords,
                columnSales: {
                  ...p.bankRecords.columnSales,
                  wine: 100,
                  whisky: 1000,
                },
              },
            }
          : p,
      ),
    };
    // 1500 + 0.4×1000 = 1900
    expect(listLoanOffers(match, "p1")[0]!.principal).toBe(1900);
  });

  it("loan 5 starts at 7000 before skill/cash terms", () => {
    const match = createFourPlayerMatch({
      matchId: "loan",
      players: [
        { id: "p1", displayName: "A" },
        { id: "p2", displayName: "B" },
        { id: "p3", displayName: "C" },
        { id: "p4", displayName: "D" },
      ],
    });
    // No skills bought/used, no cash made, 0 objective points → principal 7000
    expect(listLoanOffers(match, "p1")[4]!.principal).toBe(7000);
  });

  it("loan 4 adds max builds/turn × 5600 to figurines × 5600", () => {

    let match = createFourPlayerMatch({
      matchId: "loan",
      players: [
        { id: "p1", displayName: "A", ownedFigurines: 2 },
        { id: "p2", displayName: "B" },
        { id: "p3", displayName: "C" },
        { id: "p4", displayName: "D" },
      ],
    });
    match = {
      ...match,
      players: match.players.map((p) =>
        p.id === "p1"
          ? {
              ...p,
              bankRecords: { ...p.bankRecords, maxBuildsInOneTurn: 3 },
            }
          : p,
      ),
      // unlock loan 4
      playersKnockedOut: 0,
    };
    // Need 3 L4 builds to enable — principal still computed
    // 2×5600 + 3×5600 = 28000
    expect(listLoanOffers(match, "p1")[3]!.principal).toBe(28_000);
  });

  it("loan 2 grows with money made (borrows + skills + rate)", () => {

    let match = createFourPlayerMatch({
      matchId: "loan",
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
        p.id === "p1"
          ? {
              ...p,
              objectiveStats: {
                ...p.objectiveStats,
                moneyFromBorrows: 1000,
                moneyFromSkills: 500,
                moneyFromRates: 500,
              },
            }
          : p,
      ),
    };
    // money made = 2000 → +0.4×2000 = +800 → 2800+800 = 3600
    expect(listLoanOffers(match, "p1")[1]!.principal).toBe(3600);
  });

  it("loan 3 starts from 4200 and scales with lives", () => {
    const match = createFourPlayerMatch({
      matchId: "loan",
      players: [
        { id: "p1", displayName: "A" },
        { id: "p2", displayName: "B" },
        { id: "p3", displayName: "C" },
        { id: "p4", displayName: "D" },
      ],
    });
    const unlocked = { ...match, recycleUses: 1 };
    // 4200 + 0.5*3*4200 = 10500 at starting lives 3
    expect(listLoanOffers(unlocked, "p1")[2]!.principal).toBe(10500);
  });

  it("allows only 1 bank borrow per player", () => {

    const match = createFourPlayerMatch({
      matchId: "loan",
      players: [
        { id: "p1", displayName: "A" },
        { id: "p2", displayName: "B" },
        { id: "p3", displayName: "C" },
        { id: "p4", displayName: "D" },
      ],
    });
    const first = takeLoan(match, "p1", 1);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = takeLoan(first.state, "p1", 2);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.reason).toMatch(/Only 1 borrow/i);
    }
  });
});

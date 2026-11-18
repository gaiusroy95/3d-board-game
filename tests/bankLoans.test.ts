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

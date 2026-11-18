import { describe, expect, it } from "vitest";
import {
  bankReceivePayment,
  createBank,
  payBuildCost,
  setupPlayerMoney,
} from "@domain/bank";
import { createFourPlayerMatch } from "@domain/match";

function freshMatch() {
  return createFourPlayerMatch({
    matchId: "bank-test",
    players: [
      { id: "p1", displayName: "A" },
      { id: "p2", displayName: "B" },
      { id: "p3", displayName: "C" },
      { id: "p4", displayName: "D" },
    ],
  });
}

describe("M2-1 Bank five actions", () => {
  it("createBank starts at zero by default", () => {
    expect(createBank()).toEqual({ balance: 0 });
    expect(createBank(500)).toEqual({ balance: 500 });
  });

  it("setupPlayerMoney sets each player to the setup amount", () => {
    const match = setupPlayerMoney(freshMatch(), 1000);
    for (const p of match.players) {
      expect(p.cash).toBe(1000);
    }
  });

  it("payBuildCost moves cash player → bank for Wine L1 (200)", () => {
    let match = freshMatch();
    expect(match.players[0]!.cash).toBe(1000);

    const paid = payBuildCost(match, "p1", { column: "wine", level: 1 });
    expect(paid.ok).toBe(true);
    if (!paid.ok) return;

    match = paid.state;
    expect(match.players[0]!.cash).toBe(800);
    expect(match.bankBalance).toBe(200);
  });

  it("bankReceivePayment credits the pool", () => {
    const match = bankReceivePayment(freshMatch(), 350);
    expect(match.bankBalance).toBe(350);
  });

  it("blocks build cost when cash is insufficient", () => {
    let match = freshMatch();
    match = {
      ...match,
      players: match.players.map((p) =>
        p.id === "p1" ? { ...p, cash: 50 } : p,
      ),
    };
    const paid = payBuildCost(match, "p1", { column: "wine", level: 1 });
    expect(paid.ok).toBe(false);
  });
});

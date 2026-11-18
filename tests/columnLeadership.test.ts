import { describe, expect, it } from "vitest";
import { applyBoardInteraction } from "@domain/buildDestroy";
import { applyColumnHammer, applyColumnMaster } from "@domain/cards/columnEffects";
import {
  isColumnLeader,
  resolveBuildCostWithColumnRule,
} from "@domain/columnLeadership";
import { createFourPlayerMatch } from "@domain/match";

describe("column leadership + Master opponent %", () => {
  it("discounts cost when building higher than rivals in column", () => {
    let match = createFourPlayerMatch({
      matchId: "c",
      players: [
        { id: "p1", displayName: "A" },
        { id: "p2", displayName: "B" },
        { id: "p3", displayName: "C" },
        { id: "p4", displayName: "D" },
      ],
    });
    // p2 builds wine L1 (cost 200)
    const b = applyBoardInteraction(match, {
      type: "build",
      actorId: "p2",
      targetOwnerId: "p2",
      position: { column: "wine", level: 1 },
    });
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    match = b.state;

    // p1 building wine L3: full cost 1400, rivalMax=1 → pay L2 cost 500
    const priced = resolveBuildCostWithColumnRule(match, "p1", "wine", 3);
    expect(priced.columnLeaderDiscount).toBe(true);
    expect(priced.cost).toBe(500);
    expect(priced.fullCost).toBe(1400);
  });

  it("Master on opponent board pays 20% of build cost for +2 rank", () => {
    let match = createFourPlayerMatch({
      matchId: "c",
      players: [
        { id: "p1", displayName: "A" },
        { id: "p2", displayName: "B" },
        { id: "p3", displayName: "C" },
        { id: "p4", displayName: "D" },
      ],
    });
    match = { ...match, bankBalance: 50_000 };
    const before = match.players[0]!.cash;
    const result = applyColumnMaster(match, "p1", "p2", "wine", 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // place L2, wine L2 cost 500 → 20% = 100
    expect(result.state.players[0]!.cash).toBe(before + 100);
  });

  it("lead ends when higher build is removed; full cost reactivates until lead again", () => {
    let match = createFourPlayerMatch({
      matchId: "c",
      players: [
        { id: "p1", displayName: "A" },
        { id: "p2", displayName: "B" },
        { id: "p3", displayName: "C" },
        { id: "p4", displayName: "D" },
      ],
    });
    const r1 = applyBoardInteraction(match, {
      type: "build",
      actorId: "p2",
      targetOwnerId: "p2",
      position: { column: "wine", level: 1 },
    });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    match = r1.state;

    const r2 = applyBoardInteraction(match, {
      type: "build",
      actorId: "p1",
      targetOwnerId: "p1",
      position: { column: "wine", level: 3 },
    });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    match = r2.state;
    expect(isColumnLeader(match, "p1", "wine")).toBe(true);

    // Remove p1's lead (hammer enough to clear L3)
    const hammer = applyColumnHammer(match, "p2", "p1", "wine", 3);
    expect(hammer.ok).toBe(true);
    if (!hammer.ok) return;
    match = hammer.state;
    expect(isColumnLeader(match, "p1", "wine")).toBe(false);

    // Building L3 again while rival still at L1 still gets discount (placeLevel > rivalMax)
    const again = resolveBuildCostWithColumnRule(match, "p1", "wine", 3);
    expect(again.columnLeaderDiscount).toBe(true);

    // Building only L1 (not higher than rival L1) → no discount
    const low = resolveBuildCostWithColumnRule(match, "p1", "wine", 1);
    expect(low.columnLeaderDiscount).toBe(false);
    expect(low.cost).toBe(low.fullCost);
  });
});

import { describe, expect, it } from "vitest";
import { canUnlockFigurineSlot, tryUnlockNextFigurine } from "@domain/figurineUnlock";
import { createFourPlayerMatch } from "@domain/match";

describe("figurine unlock conditions", () => {
  it("figurine 1 needs bankBorrowCashTotal ≥ 10000", () => {
    let match = createFourPlayerMatch({
      matchId: "u",
      players: [
        { id: "p1", displayName: "A" },
        { id: "p2", displayName: "B" },
        { id: "p3", displayName: "C" },
        { id: "p4", displayName: "D" },
      ],
    });
    expect(canUnlockFigurineSlot(match, "p1", 0).ok).toBe(false);
    match = {
      ...match,
      players: match.players.map((p) =>
        p.id === "p1" ? { ...p, bankBorrowCashTotal: 10000 } : p,
      ),
    };
    expect(canUnlockFigurineSlot(match, "p1", 0).ok).toBe(true);
    const unlocked = tryUnlockNextFigurine(match, "p1");
    expect(unlocked.ok).toBe(true);
    if (!unlocked.ok) return;
    expect(unlocked.state.players[0]!.ownedFigurines).toBe(1);
  });

  it("figurine 2 needs +3 extra lives", () => {
    let match = createFourPlayerMatch({
      matchId: "u",
      players: [
        {
          id: "p1",
          displayName: "A",
          ownedFigurines: 1,
          figurineSkills: [{ slotIndex: 0, skill1Learned: false, skill2Learned: false }],
        },
        { id: "p2", displayName: "B" },
        { id: "p3", displayName: "C" },
        { id: "p4", displayName: "D" },
      ],
    });
    expect(canUnlockFigurineSlot(match, "p1", 1).ok).toBe(false);
    match = {
      ...match,
      players: match.players.map((p) =>
        p.id === "p1" ? { ...p, livesGainedExtra: 3 } : p,
      ),
    };
    expect(canUnlockFigurineSlot(match, "p1", 1).ok).toBe(true);
  });

  it("figurine 4 requires having figurine 3", () => {
    let match = createFourPlayerMatch({
      matchId: "u",
      players: [
        {
          id: "p1",
          displayName: "A",
          ownedFigurines: 2,
          figurineSkills: [0, 1].map((slotIndex) => ({
            slotIndex,
            skill1Learned: false,
            skill2Learned: false,
          })),
        },
        { id: "p2", displayName: "B" },
        { id: "p3", displayName: "C" },
        { id: "p4", displayName: "D" },
      ],
    });
    expect(canUnlockFigurineSlot(match, "p1", 3).ok).toBe(false);
    match = {
      ...match,
      players: match.players.map((p) =>
        p.id === "p1"
          ? {
              ...p,
              ownedFigurines: 3,
              figurineSkills: [0, 1, 2].map((slotIndex) => ({
                slotIndex,
                skill1Learned: false,
                skill2Learned: false,
              })),
            }
          : p,
      ),
    };
    expect(canUnlockFigurineSlot(match, "p1", 3).ok).toBe(true);
  });

  it("figurine 7 requires all conditions", () => {
    let match = createFourPlayerMatch({
      matchId: "u",
      players: [
        {
          id: "p1",
          displayName: "A",
          ownedFigurines: 6,
          figurineSkills: [0, 1, 2, 3, 4, 5].map((slotIndex) => ({
            slotIndex,
            skill1Learned: true,
            skill2Learned: false,
          })),
        },
        { id: "p2", displayName: "B" },
        { id: "p3", displayName: "C" },
        { id: "p4", displayName: "D" },
      ],
    });
    expect(canUnlockFigurineSlot(match, "p1", 6).ok).toBe(false);
    match = {
      ...match,
      players: match.players.map((p) =>
        p.id === "p1" ? { ...p, lives: 6 } : p,
      ),
    };
    expect(canUnlockFigurineSlot(match, "p1", 6).ok).toBe(true);
  });
});

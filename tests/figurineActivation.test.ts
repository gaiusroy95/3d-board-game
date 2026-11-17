import { describe, expect, it } from "vitest";
import {
  applyFigurineActivationNoOp,
  canOpenFigurinePopup,
} from "@domain/figurineActivation";
import { createFourPlayerMatch } from "@domain/match";

function demoMatch() {
  return createFourPlayerMatch({
    matchId: "t",
    players: [
      {
        id: "p1",
        displayName: "A",
        ownedFigurines: 1,
        figurineSkills: [{ slotIndex: 0, skill1Learned: true, skill2Learned: false }],
      },
      { id: "p2", displayName: "B" },
      { id: "p3", displayName: "C" },
      { id: "p4", displayName: "D" },
    ],
  });
}

describe("figurine activation stub", () => {
  it("allows popup only for owned slots", () => {
    const match = demoMatch();
    expect(canOpenFigurinePopup(match, "p1", 0).ok).toBe(true);
    expect(canOpenFigurinePopup(match, "p1", 1).ok).toBe(false);
  });

  it("does not mutate state and blocks unlearned / OPEN activation", () => {
    const match = demoMatch();
    const blocked = applyFigurineActivationNoOp(match, {
      actorId: "p1",
      slotIndex: 0,
      skillId: "skill2",
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.reason).toMatch(/not learned/i);
    }

    const learnedButOpenCosts = applyFigurineActivationNoOp(match, {
      actorId: "p1",
      slotIndex: 0,
      skillId: "skill1",
    });
    expect(learnedButOpenCosts.ok).toBe(false);
    if (!learnedButOpenCosts.ok) {
      expect(learnedButOpenCosts.reason).toMatch(/OPEN/i);
    }
    expect(match.players[0]?.ownedFigurines).toBe(1);
  });
});

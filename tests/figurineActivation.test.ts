import { describe, expect, it } from "vitest";
import {
  applyFigurineActivation,
  canOpenFigurinePopup,
} from "@domain/figurineActivation";
import { learnFigurineSkill } from "@domain/figurines";
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

describe("figurine activation (client costs)", () => {
  it("allows popup only for owned slots", () => {
    const match = demoMatch();
    expect(canOpenFigurinePopup(match, "p1", 0).ok).toBe(true);
    expect(canOpenFigurinePopup(match, "p1", 1).ok).toBe(false);
  });

  it("activates learned skill paying 500 for figurine 1", () => {
    let match = demoMatch();
    match = { ...match, bankBalance: 10_000 };

    const blocked = applyFigurineActivation(match, {
      actorId: "p1",
      slotIndex: 0,
      skillId: "skill2",
    });
    expect(blocked.ok).toBe(false);

    const activated = applyFigurineActivation(match, {
      actorId: "p1",
      slotIndex: 0,
      skillId: "skill1",
    });
    expect(activated.ok).toBe(true);
    if (!activated.ok) return;
    expect(activated.state.players[0]!.cash).toBe(1000 - 500);
  });

  it("learns a skill for 4000 on figurine 1", () => {
    let match = demoMatch();
    match = {
      ...match,
      players: match.players.map((p) =>
        p.id === "p1"
          ? {
              ...p,
              cash: 5000,
              figurineSkills: [
                { slotIndex: 0, skill1Learned: false, skill2Learned: false },
              ],
            }
          : p,
      ),
    };
    const learned = learnFigurineSkill(match, "p1", 0, "skill2");
    expect(learned.ok).toBe(true);
    if (!learned.ok) return;
    expect(learned.state.players[0]!.cash).toBe(1000);
    expect(learned.state.players[0]!.figurineSkills[0]!.skill2Learned).toBe(true);
    expect(learned.state.players[0]!.figurineSkills[0]!.skill1Learned).toBe(false);
  });
});

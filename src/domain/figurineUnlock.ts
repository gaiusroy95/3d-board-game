import type { PlayerId } from "./board";
import { unlockFigurine } from "./figurines";
import { getPlayer, type MatchState } from "./match";

export type UnlockCheck =
  | { readonly ok: true; readonly reason: string }
  | { readonly ok: false; readonly reason: string };

function countSkillsLearned(state: MatchState, playerId: PlayerId): number {
  const player = getPlayer(state, playerId);
  let n = 0;
  for (const s of player.figurineSkills) {
    if (s.skill1Learned) n += 1;
    if (s.skill2Learned) n += 1;
  }
  return n;
}

/**
 * Client unlock conditions (figurine files + follow-up answers).
 * Slot indices are 0-based.
 */
export function canUnlockFigurineSlot(
  state: MatchState,
  playerId: PlayerId,
  slotIndex: number,
): UnlockCheck {
  const player = getPlayer(state, playerId);
  if (slotIndex !== player.ownedFigurines) {
    return {
      ok: false,
      reason: `Next unlock must be slot ${player.ownedFigurines} (figurine ${player.ownedFigurines + 1}).`,
    };
  }
  if (player.ownedFigurines >= state.rules.maxFigurines) {
    return { ok: false, reason: "Already own max figurines." };
  }

  switch (slotIndex) {
    case 0:
      if (player.bankBorrowCashTotal >= 10000) {
        return { ok: true, reason: "Bank borrow total ≥ 10000." };
      }
      return {
        ok: false,
        reason:
          "Need Bank borrow total ≥ 10000, or play Deck2 Reactivate Figurine card.",
      };
    case 1:
      if (player.livesGainedExtra >= 3) {
        return {
          ok: true,
          reason: `Extra lives gained ${player.livesGainedExtra} ≥ 3.`,
        };
      }
      return {
        ok: false,
        reason: `Need +3 extra lives from cards/players (have ${player.livesGainedExtra}).`,
      };
    case 2: {
      const lent = state.playerBorrows.some((b) => b.lenderId === playerId);
      const accepted = player.playerBorrowOffersAccepted >= 1;
      if (lent || accepted) {
        return { ok: true, reason: "Has lent / accepted ≥1 player borrow." };
      }
      return {
        ok: false,
        reason: "Need ≥1 borrow on someone (as lender).",
      };
    }
    case 3:
      // Client: condition to get figurine 4 is to have figurine 3
      if (player.ownedFigurines >= 3) {
        return { ok: true, reason: "Has figurine 3." };
      }
      return {
        ok: false,
        reason: "Need figurine 3 before unlocking figurine 4.",
      };
    case 4:
      if (player.lives >= 6) {
        return { ok: true, reason: "Has 6+ lives." };
      }
      return {
        ok: false,
        reason: "Need 6 lives, or Deck3 Reactivate/special card.",
      };
    case 5:
      if (state.playersKnockedOut >= 2) {
        return { ok: true, reason: "2+ knockouts recorded this match." };
      }
      return {
        ok: false,
        reason: "Need 2 knockouts in one round, or Deck3 activation card.",
      };
    case 6: {
      const skills = countSkillsLearned(state, playerId);
      if (
        player.lives >= 6 &&
        player.ownedFigurines >= 6 &&
        skills >= 6
      ) {
        return {
          ok: true,
          reason: "All conditions: 6 lives, all figurines path, 6 skills.",
        };
      }
      return {
        ok: false,
        reason: `Need all conditions (lives≥6 have ${player.lives}, figurines≥6 have ${player.ownedFigurines}, skills≥6 have ${skills}).`,
      };
    }
    default:
      return { ok: false, reason: "Invalid slot." };
  }
}

export function tryUnlockNextFigurine(
  state: MatchState,
  playerId: PlayerId,
):
  | { readonly ok: true; readonly state: MatchState; readonly note: string }
  | { readonly ok: false; readonly state: MatchState; readonly reason: string } {
  const player = getPlayer(state, playerId);
  const slot = player.ownedFigurines;
  const check = canUnlockFigurineSlot(state, playerId, slot);
  if (!check.ok) {
    return { ok: false, state, reason: check.reason };
  }
  const unlocked = unlockFigurine(state, playerId);
  if (!unlocked.ok) {
    return { ok: false, state: unlocked.state, reason: unlocked.reason };
  }
  return {
    ok: true,
    state: unlocked.state,
    note: `Unlocked figurine ${slot + 1}. ${check.reason}`,
  };
}

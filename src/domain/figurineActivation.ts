import type { PlayerId } from "./board";
import {
  getPlayer,
  type FigurineSkillLearnState,
  type MatchState,
} from "./match";

/**
 * Figurine activation (client):
 * - Do not move figurines.
 * - Per-turn reward for having them (amounts OPEN).
 * - Learned skills activate via popup (2 buttons) after paying an activation amount (OPEN).
 * - Using a skill → two rewards (figurine + skill); amounts OPEN.
 */

export type FigurineSkillId = "skill1" | "skill2";

export interface FigurineActivateRequest {
  readonly actorId: PlayerId;
  readonly slotIndex: number;
  readonly skillId: FigurineSkillId;
}

export type FigurineActivateResult =
  | { readonly ok: true; readonly note: string }
  | { readonly ok: false; readonly reason: string };

export function getLearnStateForSlot(
  state: MatchState,
  playerId: PlayerId,
  slotIndex: number,
): FigurineSkillLearnState {
  const player = getPlayer(state, playerId);
  return (
    player.figurineSkills.find((s) => s.slotIndex === slotIndex) ?? {
      slotIndex,
      skill1Learned: false,
      skill2Learned: false,
    }
  );
}

export function canOpenFigurinePopup(
  state: MatchState,
  playerId: PlayerId,
  slotIndex: number,
): { ok: true } | { ok: false; reason: string } {
  const player = getPlayer(state, playerId);
  if (slotIndex < 0 || slotIndex >= state.rules.maxFigurines) {
    return { ok: false, reason: "Invalid figurine slot." };
  }
  if (slotIndex >= player.ownedFigurines) {
    return { ok: false, reason: "Figurine not owned (unlock condition required)." };
  }
  return { ok: true };
}

/**
 * No-op activation until learn/activation costs and rewards are confirmed.
 * Never mutates match cash/points in Milestone 1.
 */
export function applyFigurineActivationNoOp(
  state: MatchState,
  request: FigurineActivateRequest,
): FigurineActivateResult {
  const gate = canOpenFigurinePopup(state, request.actorId, request.slotIndex);
  if (!gate.ok) {
    return gate;
  }

  const learn = getLearnStateForSlot(state, request.actorId, request.slotIndex);
  const learned =
    request.skillId === "skill1" ? learn.skill1Learned : learn.skill2Learned;
  if (!learned) {
    return {
      ok: false,
      reason:
        "Skill not learned yet. Learning costs cash (amount OPEN). No state change.",
    };
  }

  // Pending confirmed activation costs and reward amounts.
  return {
    ok: false,
    reason:
      "Skill activation costs and reward amounts are OPEN. Popup choice recorded as no-op; no cash/points mutation.",
  };
}

import type { PlayerId } from "./board";
import {
  activateFigurineSkill,
  type FigurineSkillId,
} from "./figurines";
import {
  getPlayer,
  type FigurineSkillLearnState,
  type MatchState,
} from "./match";

export type { FigurineSkillId };

export interface FigurineActivateRequest {
  readonly actorId: PlayerId;
  readonly slotIndex: number;
  readonly skillId: FigurineSkillId;
}

export type FigurineActivateResult =
  | { readonly ok: true; readonly state: MatchState; readonly note: string }
  | { readonly ok: false; readonly state: MatchState; readonly reason: string };

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

export function applyFigurineActivation(
  state: MatchState,
  request: FigurineActivateRequest,
): FigurineActivateResult {
  const result = activateFigurineSkill(
    state,
    request.actorId,
    request.slotIndex,
    request.skillId,
  );
  if (!result.ok) {
    return { ok: false, state: result.state, reason: result.reason };
  }
  return { ok: true, state: result.state, note: result.note };
}

/** @deprecated Prefer applyFigurineActivation */
export function applyFigurineActivationNoOp(
  state: MatchState,
  request: FigurineActivateRequest,
): FigurineActivateResult {
  return applyFigurineActivation(state, request);
}

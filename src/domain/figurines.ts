import { bankReceivePayment } from "./bank";
import type { PlayerId } from "./board";
import { getFigurineConfig } from "./figurineConfig";
import { getPlayer, type MatchState, type PlayerMatchState } from "./match";

export type FigurineSkillId = "skill1" | "skill2";

export type FigurineActionResult =
  | { readonly ok: true; readonly state: MatchState; readonly note: string }
  | { readonly ok: false; readonly state: MatchState; readonly reason: string };

function ownedSlotOk(
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

function learnState(
  state: MatchState,
  playerId: PlayerId,
  slotIndex: number,
) {
  const player = getPlayer(state, playerId);
  return (
    player.figurineSkills.find((s) => s.slotIndex === slotIndex) ?? {
      slotIndex,
      skill1Learned: false,
      skill2Learned: false,
    }
  );
}

export function unlockFigurine(
  state: MatchState,
  playerId: PlayerId,
): FigurineActionResult {
  const player = getPlayer(state, playerId);
  if (player.ownedFigurines >= state.rules.maxFigurines) {
    return { ok: false, state, reason: "Already own the maximum figurines." };
  }
  const slotIndex = player.ownedFigurines;
  const nextPlayers = state.players.map((p) =>
    p.id === playerId
      ? {
          ...p,
          ownedFigurines: p.ownedFigurines + 1,
          figurineSkills: [
            ...p.figurineSkills,
            { slotIndex, skill1Learned: false, skill2Learned: false },
          ],
        }
      : p,
  );
  return {
    ok: true,
    state: { ...state, players: nextPlayers },
    note: `Unlocked figurine slot ${slotIndex}.`,
  };
}

export function learnFigurineSkill(
  state: MatchState,
  playerId: PlayerId,
  slotIndex: number,
  skillId: FigurineSkillId,
): FigurineActionResult {
  const gate = ownedSlotOk(state, playerId, slotIndex);
  if (!gate.ok) return { ok: false, state, reason: gate.reason };

  const cost = getFigurineConfig(slotIndex).learnCost;
  const player = getPlayer(state, playerId);
  if (player.cash < cost) {
    return {
      ok: false,
      state,
      reason: `Need ${cost} cash to learn skill; have ${player.cash}.`,
    };
  }

  const learn = learnState(state, playerId, slotIndex);
  if (skillId === "skill1" && learn.skill1Learned) {
    return { ok: false, state, reason: "Skill 1 already learned." };
  }
  if (skillId === "skill2" && learn.skill2Learned) {
    return { ok: false, state, reason: "Skill 2 already learned." };
  }

  // Client: choose 1 of 2 — learning one blocks the other for that figurine
  const nextPlayers: PlayerMatchState[] = state.players.map((p) => {
    if (p.id !== playerId) return p;
    const skills = [...p.figurineSkills];
    const idx = skills.findIndex((s) => s.slotIndex === slotIndex);
    const updated = {
      slotIndex,
      skill1Learned: skillId === "skill1",
      skill2Learned: skillId === "skill2",
    };
    if (idx >= 0) skills[idx] = updated;
    else skills.push(updated);
    return { ...p, cash: p.cash - cost, figurineSkills: skills };
  });

  const afterPay = bankReceivePayment({ ...state, players: nextPlayers }, cost);
  const cfg = getFigurineConfig(slotIndex);
  return {
    ok: true,
    state: afterPay,
    note: `Learned ${skillId} on figurine ${slotIndex + 1} for ${cost}. (${cfg.skillSummaries[skillId === "skill1" ? 0 : 1]})`,
  };
}

export function activateFigurineSkill(
  state: MatchState,
  playerId: PlayerId,
  slotIndex: number,
  skillId: FigurineSkillId,
): FigurineActionResult {
  const gate = ownedSlotOk(state, playerId, slotIndex);
  if (!gate.ok) return { ok: false, state, reason: gate.reason };

  const learn = learnState(state, playerId, slotIndex);
  const learned =
    skillId === "skill1" ? learn.skill1Learned : learn.skill2Learned;
  if (!learned) {
    return { ok: false, state, reason: "Skill not learned yet." };
  }

  const player = getPlayer(state, playerId);
  let activateCost = getFigurineConfig(slotIndex).activateCost;
  let next = state;
  let reuseNote = "";

  if (player.skillReusesRemaining > 0) {
    // Skill-class card: reuse without paying activation (consume one reuse)
    next = {
      ...next,
      players: next.players.map((p) =>
        p.id === playerId
          ? { ...p, skillReusesRemaining: p.skillReusesRemaining - 1 }
          : p,
      ),
    };
    reuseNote = " (skill-class reuse, no activate cost)";
  } else {
    if (player.cash < activateCost) {
      return {
        ok: false,
        state,
        reason: `Need ${activateCost} to activate; have ${player.cash}.`,
      };
    }
    const nextPlayers = next.players.map((p) =>
      p.id === playerId ? { ...p, cash: p.cash - activateCost } : p,
    );
    next = bankReceivePayment({ ...next, players: nextPlayers }, activateCost);
  }

  // Figurine 2: skill uses raise special-card limit
  if (slotIndex === 1) {
    next = {
      ...next,
      players: next.players.map((p) => {
        if (p.id !== playerId) return p;
        const uses = p.figurine2SkillUses + 1;
        const cardLimit = uses === 1 ? 5 : uses === 2 ? 6 : 7;
        return {
          ...p,
          figurine2SkillUses: uses,
          maxSpecialCardsThisTurn: cardLimit,
        };
      }),
    };
  }

  // Figurine 7 skill1: +10 points → grant via temporary Level5-equivalent not available;
  // track as cash-neutral note; points come from L5/figurines. Store bonus points on player? 
  // For now: figurine 7 skill1 adds a pseudo "points" by unlocking nothing — use lives/cash paths.
  // Client: "you get 10 points" — add ownedFigurines points already; we need a pointsBonus field.
  // Minimal: attach via lives for skill2 (+1 life is reward on unlock). For skill1 +10 pts:
  // extend scoring later; for M2 store in a simple way — increase a match-side map.
  // Skip inventing storage: if skill1 on slot 6, note only and leave OPEN for points ledger.
  let noteExtra = "";
  if (slotIndex === 6 && skillId === "skill1") {
    noteExtra = " +10 points pending points-ledger (OPEN wiring to score).";
  }
  if (slotIndex === 6 && skillId === "skill2") {
    noteExtra = " Force return 50% borrowed cash — select borrower (OPEN target UI).";
  }

  return {
    ok: true,
    state: next,
    note: `Activated figurine ${slotIndex + 1} ${skillId}${reuseNote}.${noteExtra}`,
  };
}

export function applyFigurineHavingReward(
  state: MatchState,
  playerId: PlayerId,
): FigurineActionResult {
  const player = getPlayer(state, playerId);
  if (player.ownedFigurines <= 0) {
    return { ok: true, state, note: "No figurines — no having reward." };
  }
  // Client rewards are per-figurine and often non-cash; do not invent flat cash.
  // Having reward application is pending exact reward choice UI.
  return {
    ok: true,
    state,
    note: `Having reward pending choice for ${player.ownedFigurines} figurine(s) (client reward tables).`,
  };
}

/** Claim Get Rich card rewards for a chosen owned figurine (grants documented summary only for now). */
export function claimGetRichReward(
  state: MatchState,
  playerId: PlayerId,
  slotIndex: number,
): FigurineActionResult {
  const player = getPlayer(state, playerId);
  if (player.pendingGetRichRewards <= 0) {
    return { ok: false, state, reason: "No pending Get Rich rewards." };
  }
  if (slotIndex >= player.ownedFigurines) {
    return { ok: false, state, reason: "Figurine not owned." };
  }
  const cfg = getFigurineConfig(slotIndex);
  const nextPlayers = state.players.map((p) =>
    p.id === playerId
      ? { ...p, pendingGetRichRewards: p.pendingGetRichRewards - 1 }
      : p,
  );
  return {
    ok: true,
    state: { ...state, players: nextPlayers },
    note: `Get Rich: claimed reward on figurine ${slotIndex + 1} (${cfg.rewardSummary}). Remaining ${player.pendingGetRichRewards - 1}.`,
  };
}

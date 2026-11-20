/**
 * Build a playable MatchState from a tournament match + stage phase preset.
 */

import {
  cellKey,
  createEmptyBoard,
  type PlayerId,
} from "./board";
import {
  createFourPlayerMatch,
  refreshScorePeaks,
  scoreForPlayer,
  type MatchState,
} from "./match";
import { milestone2RulesConfig } from "./rulesConfig";
import type { TournamentMatch, TournamentStageId } from "./tournament";
import {
  builtCellsFromColumnLevels,
  phasePresetFor,
  type TournamentPhasePreset,
} from "./tournamentPhase";

export function applyPhasePresetToMatch(
  state: MatchState,
  preset: TournamentPhasePreset,
): MatchState {
  const built = builtCellsFromColumnLevels(preset.columnLevels);
  const players = state.players.map((p) => {
    const empty = createEmptyBoard(p.id);
    const cells = { ...empty.cells };
    for (const cell of built) {
      cells[cellKey(cell.column, cell.level)] = {
        kind: "built",
        builtBy: p.id,
      };
    }
    return {
      ...p,
      cash: preset.startingCash,
      ownedFigurines: preset.ownedFigurines,
      board: { ownerId: p.id, cells },
    };
  });
  return refreshScorePeaks({ ...state, players });
}

/**
 * Creates a 4-player match with phase cash, figurines, and pre-built boards.
 * Knocked-out seats are still included (Steam join later); they start with the
 * same board but tournament KO is tracked on the bracket side.
 */
export function createMatchFromTournamentSeat(
  match: TournamentMatch,
  stageId: TournamentStageId,
): MatchState {
  if (match.participants.length !== 4) {
    throw new Error(`Tournament match ${match.id} needs 4 participants.`);
  }
  const preset = phasePresetFor(stageId);
  const rules = {
    ...milestone2RulesConfig,
    startingCash: preset.startingCash,
    startingFigurines: preset.ownedFigurines,
  };
  const base = createFourPlayerMatch({
    matchId: `tournament-${match.id}`,
    players: match.participants.map((p) => ({
      id: p.playerId as PlayerId,
      displayName: p.displayName,
      ownedFigurines: preset.ownedFigurines,
    })),
    rules,
  });
  return applyPhasePresetToMatch(base, preset);
}

export function figurinePointsForPreset(
  preset: TournamentPhasePreset,
): number {
  return preset.ownedFigurines * milestone2RulesConfig.pointsPerFigurine;
}

export function assertPhaseStartScores(
  state: MatchState,
  preset: TournamentPhasePreset,
): void {
  const expected = figurinePointsForPreset(preset);
  for (const p of state.players) {
    const score = scoreForPlayer(state, p.id);
    if (score !== expected) {
      throw new Error(
        `Phase ${preset.stageId}: ${p.displayName} score ${score}, expected ${expected} (figurines only; L1–4 builds are 0 pts).`,
      );
    }
  }
}

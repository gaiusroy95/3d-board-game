/**
 * Tournament phase starting presets (client M4 answers).
 * Presets apply identically to every player’s own board at match start.
 */

import type { ColumnId, Level } from "./board";
import type { TournamentStageId } from "./tournament";

export interface PhaseBoardCell {
  readonly column: ColumnId;
  readonly level: Level;
}

export interface TournamentPhasePreset {
  readonly stageId: TournamentStageId;
  readonly label: string;
  /** Starting cash for each player. */
  readonly startingCash: number;
  /** Pre-unlocked figurine count (0..7). */
  readonly ownedFigurines: number;
  /** Expected figurine points at start (ownedFigurines × 5). */
  readonly startingFigurinePoints: number;
  /**
   * Highest built level per column at match start (empty = none).
   * Builds are attributed to the board owner.
   */
  readonly columnLevels: Readonly<Partial<Record<ColumnId, Level>>>;
  readonly notes: string;
}

/** Round 1 — normal casual start. */
export const PHASE_ROUND1: TournamentPhasePreset = {
  stageId: "round1",
  label: "Round 1 — normal",
  startingCash: 1000,
  ownedFigurines: 0,
  startingFigurinePoints: 0,
  columnLevels: {},
  notes: "Normal match start (client: Round 1 normally).",
};

/**
 * Round 2 — figurines 1+2 achieved (+10 pts), Wine L3, Rum L2, others L1, cash 3000.
 */
export const PHASE_ROUND2: TournamentPhasePreset = {
  stageId: "round2",
  label: "Round 2 — figurines 1–2",
  startingCash: 3000,
  ownedFigurines: 2,
  startingFigurinePoints: 10,
  columnLevels: {
    wine: 3,
    rum: 2,
    tequila: 1,
    vodka: 1,
    whisky: 1,
  },
  notes:
    "Figurines 1–2 unlocked (10 pts); Wine L3, Rum L2, other columns L1; cash 3000.",
};

/**
 * Final — 2 figurines (10 pts), Wine/Rum/Tequila L3, Vodka L2, Whisky L1, cash 4000.
 */
export const PHASE_FINAL: TournamentPhasePreset = {
  stageId: "final",
  label: "Final — figurines 1–2",
  startingCash: 4000,
  ownedFigurines: 2,
  startingFigurinePoints: 10,
  columnLevels: {
    wine: 3,
    rum: 3,
    tequila: 3,
    vodka: 2,
    whisky: 1,
  },
  notes:
    "Client: 2 figurines at Final (start 10 points); Wine L3, Rum L3, Tequila L3, Vodka L2, Whisky L1; cash 4000.",
};

export const TOURNAMENT_PHASE_PRESETS: Readonly<
  Record<TournamentStageId, TournamentPhasePreset>
> = {
  round1: PHASE_ROUND1,
  round2: PHASE_ROUND2,
  final: PHASE_FINAL,
};

export function phasePresetFor(
  stageId: TournamentStageId,
): TournamentPhasePreset {
  return TOURNAMENT_PHASE_PRESETS[stageId];
}

/** Expand column max-level map into explicit built cells (levels 1..max). */
export function builtCellsFromColumnLevels(
  columnLevels: Readonly<Partial<Record<ColumnId, Level>>>,
): PhaseBoardCell[] {
  const cells: PhaseBoardCell[] = [];
  for (const [column, maxLevel] of Object.entries(columnLevels) as [
    ColumnId,
    Level,
  ][]) {
    for (let level = 1; level <= maxLevel; level++) {
      cells.push({ column, level: level as Level });
    }
  }
  return cells;
}

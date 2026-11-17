import type { BoardRowOrientation, Level } from "./board";
import { DEFAULT_BOARD_ORIENTATION } from "./board";

/**
 * Configurable rules. Confirmed fields are fixed; OPEN fields stay nullable/TBD
 * so we do not invent client values.
 */
export interface GameRulesConfig {
  readonly boardOrientation: BoardRowOrientation;
  /** Client: level-turns are mandatory. */
  readonly useLevelTurns: true;
  readonly maxFigurines: 7;
  readonly pointsPerFigurine: 5;
  readonly pointsPerLevel5Cell: 5;
  /**
   * OPEN: exact jump when current level has no exact builds.
   * Prototype helper uses "next-higher-level-with-builds" until confirmed.
   */
  readonly emptyLevelJumpPolicy: "next-higher-level-with-builds" | "unconfirmed";
  /** OPEN: win at 70 / special end — not enforced in M1 domain yet. */
  readonly pointsThresholdForFinalOptions: number | null;
  /** OPEN: lose rules. */
  readonly loseOnZeroLives: boolean | null;
  readonly loseOnCashAtOrBelow: number | null;
  /** Starting cash/lives — OPEN. */
  readonly startingCash: number | null;
  readonly startingLives: number | null;
  /** Starting figurines: client said obtained only via condition → prototype 0. */
  readonly startingFigurines: number;
  readonly levels: readonly Level[];
}

export const milestone1RulesConfig: GameRulesConfig = {
  boardOrientation: DEFAULT_BOARD_ORIENTATION,
  useLevelTurns: true,
  maxFigurines: 7,
  pointsPerFigurine: 5,
  pointsPerLevel5Cell: 5,
  // Documented prototype policy until client confirms jump rule.
  emptyLevelJumpPolicy: "next-higher-level-with-builds",
  pointsThresholdForFinalOptions: 70,
  loseOnZeroLives: true,
  loseOnCashAtOrBelow: -7000,
  startingCash: null,
  startingLives: null,
  startingFigurines: 0,
  levels: [1, 2, 3, 4, 5],
};

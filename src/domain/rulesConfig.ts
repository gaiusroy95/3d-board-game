import type { BoardRowOrientation, Level } from "./board";
import { DEFAULT_BOARD_ORIENTATION } from "./board";
import { M2Assumptions } from "./assumptions";

/**
 * Configurable rules. Confirmed fields are fixed; OPEN fields use documented M2 assumptions.
 */
export interface GameRulesConfig {
  readonly boardOrientation: BoardRowOrientation;
  /** Client: level-turns are mandatory. */
  readonly useLevelTurns: true;
  readonly maxFigurines: 7;
  readonly pointsPerFigurine: 5;
  readonly pointsPerLevel5Cell: 5;
  /**
   * OPEN advanced jump when empty — M1 used next-higher-with-builds.
   * Current turn model advances player+level together each End turn.
   */
  readonly emptyLevelJumpPolicy: "next-higher-level-with-builds" | "unconfirmed" | "paired-with-player";
  readonly pointsThresholdForFinalOptions: number;
  readonly loseOnZeroLives: boolean;
  readonly loseOnCashAtOrBelow: number;
  readonly startingCash: number;
  readonly startingLives: number;
  /** Starting figurines: client said obtained only via condition → default 0. */
  readonly startingFigurines: number;
  readonly levels: readonly Level[];
  readonly maxSpecialCardsPlayedPerTurn: number;
}

export const milestone2RulesConfig: GameRulesConfig = {
  boardOrientation: DEFAULT_BOARD_ORIENTATION,
  useLevelTurns: true,
  maxFigurines: 7,
  pointsPerFigurine: 5,
  pointsPerLevel5Cell: 5,
  emptyLevelJumpPolicy: "paired-with-player",
  pointsThresholdForFinalOptions: 70,
  loseOnZeroLives: true,
  loseOnCashAtOrBelow: -7000,
  startingCash: M2Assumptions.startingCash,
  startingLives: M2Assumptions.startingLives,
  startingFigurines: 0,
  levels: [1, 2, 3, 4, 5],
  maxSpecialCardsPlayedPerTurn: M2Assumptions.maxSpecialCardsPlayedPerTurn,
};

/** @deprecated Use milestone2RulesConfig */
export const milestone1RulesConfig = milestone2RulesConfig;

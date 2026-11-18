import type { BoardPosition, PlayerId } from "./board";

export type BorrowRateOption = 30 | 40 | 50 | 60;

export interface BuildBorrow {
  readonly id: string;
  readonly borrowerId: PlayerId;
  readonly position: BoardPosition;
  readonly buildCost: number;
  readonly paid: number;
}

export interface PlayerBorrow {
  readonly id: string;
  readonly borrowerId: PlayerId;
  readonly lenderId: PlayerId;
  readonly principal: number;
  readonly premiumPercent: BorrowRateOption;
  readonly deliverAtTurnIndex: number | null;
  readonly borrowOrdinal: number;
  readonly usedLowerRate: boolean;
}

/**
 * Type-2 board-build advantage: owner let builder place on their board;
 * owner gets 20% of calculating rate each turn while that build stands.
 */
export interface BoardBuildAdvantage {
  readonly boardOwnerId: PlayerId;
  readonly builderId: PlayerId;
  readonly position: BoardPosition;
}

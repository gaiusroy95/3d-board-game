import {
  anyExactBuildOnLevel,
  assertBoardHas25Cells,
  createEmptyBoard,
  type Level,
  type PlayerBoard,
  type PlayerId,
} from "./board";
import type {
  BoardBuildAdvantage,
  BuildBorrow,
  CashBorrowOffer,
  PlayerBorrow,
} from "./borrowTypes";
import {
  createInitialCardsState,
  type MatchCardsState,
} from "./cards/state";
import {
  emptyBankRecords,
  type PlayerBankRecords,
} from "./bankRecordTypes";
import {
  createInitialObjectivesState,
  emptyObjectiveStats,
  type MatchObjectivesState,
  type PlayerObjectiveStats,
  type RaceObjectiveId,
} from "./objectiveTypes";
import { milestone2RulesConfig, type GameRulesConfig } from "./rulesConfig";
import { scorePlayerTotal } from "./scoring";

export type {
  BoardBuildAdvantage,
  BuildBorrow,
  CashBorrowOffer,
  PlayerBorrow,
} from "./borrowTypes";

export interface BlockedCellState {
  readonly blockedBy: PlayerId;
  readonly turnsRemaining: number;
}

export interface ActiveLoan {
  readonly button: 1 | 2 | 3 | 4 | 5;
  readonly principal: number;
  readonly repaymentDue: number;
  readonly borrowerId: PlayerId;
}

export interface FigurineSkillLearnState {
  readonly slotIndex: number;
  readonly skill1Learned: boolean;
  readonly skill2Learned: boolean;
}

export interface PendingColumnCard {
  readonly kind: "column-master" | "column-hammer";
  readonly column: import("./board").ColumnId;
  readonly amount: number;
  readonly cardName: string;
}

export interface PlayerMatchState {
  readonly id: PlayerId;
  readonly displayName: string;
  readonly board: PlayerBoard;
  readonly cash: number;
  readonly lives: number;
  /** Permit to build on opponent boards (card/condition). */
  readonly canBuildOnOpponent: boolean;
  readonly specialCardsPlayedThisTurn: number;
  /** Effective max special cards this turn (base 4; fig2 skill can raise). */
  readonly maxSpecialCardsThisTurn: number;
  /** Skill-class card: remaining free skill reuses. */
  readonly skillReusesRemaining: number;
  /** Get-rich card: pending figurine reward picks. */
  readonly pendingGetRichRewards: number;
  /** Master/Hammer awaiting a board+column target (selected cell). */
  readonly pendingColumnCard: PendingColumnCard | null;
  /** Times this player borrowed from the Bank this match (max 1). */
  readonly bankBorrowsUsed: number;
  /** Total cash received from Bank borrows (figurine 1 unlock ≥10000). */
  readonly bankBorrowCashTotal: number;
  /**
   * Extra lives gained beyond starting (Healer cards / players).
   * Figurine 2 unlock needs ≥3.
   */
  readonly livesGainedExtra: number;
  /** 0..maxFigurines; unlocked via conditions / cards. */
  readonly ownedFigurines: number;
  readonly figurineSkills: readonly FigurineSkillLearnState[];
  /** Figurine 2: how many times its skill was used (raises card limit). */
  readonly figurine2SkillUses: number;
  /** Offers of player-borrow this player accepted as lender (figurine 4). */
  readonly playerBorrowOffersAccepted: number;
  /** Points earned from objectives (+5 each). */
  readonly objectivePoints: number;
  /** Up to 4 of 7 race objectives. */
  readonly selectedRaceObjectives: readonly RaceObjectiveId[];
  readonly objectiveStats: PlayerObjectiveStats;
  /** Bank loan record lists (column/level sales, builds, recycle). */
  readonly bankRecords: PlayerBankRecords;
  /** Last recorded total score (for first-to-top tie-break). */
  readonly lastRecordedScore: number;
  /** Turn index when current score was first reached. */
  readonly scorePeakTurnIndex: number;
}

export interface LevelTurnState {
  /** Current level-turn (mandatory per client M1-7). */
  readonly activeLevel: Level;
  /** Index into match.playerOrder. */
  readonly activePlayerIndex: number;
}

export interface MatchState {
  readonly id: string;
  readonly players: readonly PlayerMatchState[];
  /** Stable turn order (prototype: creation order). */
  readonly playerOrder: readonly PlayerId[];
  readonly levelTurn: LevelTurnState;
  readonly rules: GameRulesConfig;
  /** Shared bank pool balance (ASSUMPTION A6). */
  readonly bankBalance: number;
  readonly cards: MatchCardsState;
  readonly activeLoans: readonly ActiveLoan[];
  /** Times any player recycled (loan button 3 gate). */
  readonly recycleUses: number;
  readonly playersKnockedOut: number;
  /** Global End-turn counter (for scheduling player-borrow repayment). */
  readonly turnIndex: number;
  readonly buildBorrows: readonly BuildBorrow[];
  readonly playerBorrows: readonly PlayerBorrow[];
  /** Open lender offers — borrower selects amount on their turn. */
  readonly cashBorrowOffers: readonly CashBorrowOffer[];
  /** Type-2: standing opponent builds that pay board owner 20%/turn. */
  readonly boardBuildAdvantages: readonly BoardBuildAdvantage[];
  /** Cells blocked by figurine skills: `${column}:${level}` → state. */
  readonly blockedCells: Readonly<Record<string, BlockedCellState>>;
  readonly overLevel5BonusActive: {
    readonly playerId: PlayerId;
    readonly column: import("./board").ColumnId;
    readonly multiplier: number;
    readonly expiresAfterTurnOf: PlayerId;
  } | null;
  readonly objectives: MatchObjectivesState;
}

export function createFourPlayerMatch(input: {
  matchId: string;
  players: readonly {
    id: PlayerId;
    displayName: string;
    ownedFigurines?: number;
    figurineSkills?: readonly FigurineSkillLearnState[];
  }[];
  rules?: GameRulesConfig;
}): MatchState {
  if (input.players.length !== 4) {
    throw new Error("A match requires exactly 4 players");
  }

  const rules = input.rules ?? milestone2RulesConfig;
  const players: PlayerMatchState[] = input.players.map((p) => {
    const board = createEmptyBoard(p.id);
    assertBoardHas25Cells(board);
    const ownedFigurines = p.ownedFigurines ?? rules.startingFigurines;
    if (ownedFigurines < 0 || ownedFigurines > rules.maxFigurines) {
      throw new Error(`ownedFigurines must be 0..${rules.maxFigurines}`);
    }
    return {
      id: p.id,
      displayName: p.displayName,
      board,
      cash: rules.startingCash,
      lives: rules.startingLives,
      ownedFigurines,
      figurineSkills: p.figurineSkills ?? [],
      canBuildOnOpponent: false,
      specialCardsPlayedThisTurn: 0,
      maxSpecialCardsThisTurn: rules.maxSpecialCardsPlayedPerTurn,
      skillReusesRemaining: 0,
      pendingGetRichRewards: 0,
      pendingColumnCard: null,
      bankBorrowsUsed: 0,
      bankBorrowCashTotal: 0,
      livesGainedExtra: 0,
      figurine2SkillUses: 0,
      playerBorrowOffersAccepted: 0,
      objectivePoints: 0,
      selectedRaceObjectives: [],
      objectiveStats: emptyObjectiveStats(),
      bankRecords: emptyBankRecords(),
      lastRecordedScore: 0,
      scorePeakTurnIndex: 0,
    };
  });

  const playerOrder = players.map((p) => p.id);
  return {
    id: input.matchId,
    players,
    playerOrder,
    levelTurn: {
      activeLevel: 1,
      activePlayerIndex: 0,
    },
    rules,
    bankBalance: 0,
    cards: createInitialCardsState(playerOrder, { shuffle: false }),
    activeLoans: [],
    recycleUses: 0,
    playersKnockedOut: 0,
    turnIndex: 0,
    buildBorrows: [],
    playerBorrows: [],
    cashBorrowOffers: [],
    boardBuildAdvantages: [],
    blockedCells: {},
    overLevel5BonusActive: null,
    objectives: createInitialObjectivesState(),
  };
}

export function getPlayer(state: MatchState, playerId: PlayerId): PlayerMatchState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    throw new Error(`Unknown player: ${playerId}`);
  }
  return player;
}

export function getActivePlayerId(state: MatchState): PlayerId {
  const id = state.playerOrder[state.levelTurn.activePlayerIndex];
  if (!id) {
    throw new Error("Invalid activePlayerIndex");
  }
  return id;
}

export function scoreForPlayer(state: MatchState, playerId: PlayerId): number {
  const player = getPlayer(state, playerId);
  return (
    scorePlayerTotal(player.board, player.ownedFigurines) + player.objectivePoints
  );
}

/**
 * Stamp when each player's score rises — used for “first on top” ties.
 */
export function refreshScorePeaks(state: MatchState): MatchState {
  return {
    ...state,
    players: state.players.map((p) => {
      const score = scoreForPlayer(state, p.id);
      if (score > p.lastRecordedScore) {
        return {
          ...p,
          lastRecordedScore: score,
          scorePeakTurnIndex: state.turnIndex,
        };
      }
      return p;
    }),
  };
}

/**
 * OPEN jump policy helper used when `emptyLevelJumpPolicy` is
 * "next-higher-level-with-builds": from `fromLevel`, find the next level
 * in 1..5 (wrapping once) that has any exact build. If none, keep `fromLevel`.
 */
export function resolveLevelTurnWithBuilds(
  boards: readonly PlayerBoard[],
  fromLevel: Level,
): Level {
  for (let step = 0; step < 5; step += 1) {
    const candidate = ((((fromLevel - 1 + step) % 5) + 5) % 5) + 1;
    const level = candidate as Level;
    if (anyExactBuildOnLevel(boards, level)) {
      return level;
    }
  }
  return fromLevel;
}

/**
 * Advance player and level together (client M1 correction):
 * each End turn moves to the next player and the next level by the same step.
 * Example: P1/L1 → P2/L2 → P3/L3 → P4/L4 → P1/L5 → P2/L1 …
 */
export function advanceTurn(state: MatchState): MatchState {
  const playerCount = state.playerOrder.length;
  const nextPlayerIndex = (state.levelTurn.activePlayerIndex + 1) % playerCount;
  const nextLevel = (state.levelTurn.activeLevel === 5
    ? 1
    : state.levelTurn.activeLevel + 1) as Level;

  const leavingId = state.playerOrder[state.levelTurn.activePlayerIndex];
  const clearBonus =
    state.overLevel5BonusActive?.expiresAfterTurnOf === leavingId
      ? null
      : state.overLevel5BonusActive;

  return {
    ...state,
    overLevel5BonusActive: clearBonus,
    levelTurn: {
      activeLevel: nextLevel,
      activePlayerIndex: nextPlayerIndex,
    },
    players: state.players.map((p) => {
      const cardLimit =
        p.figurine2SkillUses <= 0
          ? state.rules.maxSpecialCardsPlayedPerTurn
          : p.figurine2SkillUses === 1
            ? 5
            : p.figurine2SkillUses === 2
              ? 6
              : 7;
      return {
        ...p,
        specialCardsPlayedThisTurn: 0,
        maxSpecialCardsThisTurn: cardLimit,
      };
    }),
  };
}

/** Replace one player's board without touching others (isolation helper). */
export function replacePlayerBoard(
  state: MatchState,
  playerId: PlayerId,
  board: PlayerBoard,
): MatchState {
  if (board.ownerId !== playerId) {
    throw new Error("Board ownerId must match playerId");
  }
  assertBoardHas25Cells(board);
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId ? { ...p, board } : p,
    ),
  };
}

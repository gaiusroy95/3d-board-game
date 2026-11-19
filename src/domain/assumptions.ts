/**
 * Milestone 2 temporary defaults for OPEN client items.
 * Not client-approved facts — keep configurable and documented in dev-brief/docs/M2_ASSUMPTIONS.md.
 */
export const M2Assumptions = {
  /** A1 */
  startingCash: 1000,
  /** A11 */
  startingLives: 3,
  /** A2 */
  blockBuildIfInsufficientCash: true,
  /** A3 */
  normalPayoutPerCell: true,
  /**
   * A4 — pay Normal/Extra for the level that was active, then advance player+level.
   */
  payoutOnEndTurnBeforeAdvance: true,
  /** A6 */
  useBankPool: true,
  /** A9 */
  maxSpecialCardsPlayedPerTurn: 4,
  /** A10 — client D–F: Destroy stays disabled. */
  destroyEnabled: false,
  /**
   * A13 — client: Extra/limit scheme is **without limit**.
   * Keep multiplier at 1 (full calculating-rate Extra; no tier table).
   */
  extraLimitSchemeMultiplier: 1,
  extraHasLimitScheme: false,
  /**
   * A12 — superseded by per-slot costs in figurineConfig.ts (client files).
   * Kept only for any legacy call sites.
   */
  figurineHavingRewardCash: 0,
  figurineSkillRewardCash: 0,
  figurineLearnCostCash: 4000,
  figurineActivateCostCash: 500,
  /** Client: only 1 borrow from Bank per player. */
  maxBankBorrowsPerPlayer: 1,
  /**
   * Blocked levels auto-unblock. Client: normally 2 turns;
   * scales with how many distinct players currently have blocks.
   */
  blockedCellAutoUnblockTurns: 2,
  /** Build-borrow installment / type-2 advantage (20% each turn). */
  buildBorrowPercentPerTurn: 0.2,
  /** Board-owner advantage while opponent build stands (calculating-rate × this). */
  boardBuildAdvantagePercentPerTurn: 0.2,
  /**
   * @deprecated Prefer percent-of-principal unlock (20/30/40% of build/principal).
   * Kept as flat fallback only.
   */
  lowerBorrowRateUnlockFee: 1000,
  /** Product title (client). */
  gameTitle: "Back in century 20",
} as const;

export type M2AssumptionsConfig = typeof M2Assumptions;

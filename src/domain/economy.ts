import type { ColumnIndex, Level } from "./board";

/**
 * Build costs and money payouts from CLIENT_MECHANICS_FROM_CLIENT.md.
 * Client confirmed lists are Level 5 → Level 1 (M1-1).
 *
 * Money payout = cost × column percent (verified against client tables).
 * Client also said builder “gets percent from his cash” (M1-4) — cash-ledger
 * transfer semantics remain OPEN; these tables are the numeric rates.
 */

/** Column percent of build cost paid as money to the builder. */
export const COLUMN_MONEY_PERCENT: Record<ColumnIndex, number> = {
  1: 0.5,
  2: 0.4,
  3: 0.3,
  4: 0.2,
  5: 0.1,
};

/** costByLevel[level] for each column index. */
export const BUILD_COST: Record<ColumnIndex, Record<Level, number>> = {
  1: { 5: 7000, 4: 3300, 3: 1400, 2: 500, 1: 200 },
  2: { 5: 14000, 4: 6000, 3: 2400, 2: 1000, 1: 300 },
  3: { 5: 21000, 4: 8400, 3: 3500, 2: 1600, 1: 400 },
  4: { 5: 28000, 4: 11200, 3: 4500, 2: 1800, 1: 500 },
  5: { 5: 35000, 4: 14000, 3: 5600, 2: 2200, 1: 600 },
};

/** Client “calculating rate” tables (same Level 5 → 1 order). */
export const BUILD_MONEY_PAYOUT: Record<ColumnIndex, Record<Level, number>> = {
  1: { 5: 3500, 4: 1650, 3: 700, 2: 250, 1: 100 },
  2: { 5: 5600, 4: 2400, 3: 960, 2: 400, 1: 120 },
  3: { 5: 6300, 4: 2520, 3: 1050, 2: 480, 1: 120 },
  4: { 5: 5600, 4: 2240, 3: 900, 2: 360, 1: 100 },
  5: { 5: 3500, 4: 1400, 3: 560, 2: 220, 1: 60 },
};

export function getBuildCost(column: ColumnIndex, level: Level): number {
  return BUILD_COST[column][level];
}

export function getBuildMoneyPayout(column: ColumnIndex, level: Level): number {
  return BUILD_MONEY_PAYOUT[column][level];
}

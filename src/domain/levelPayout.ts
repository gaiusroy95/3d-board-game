import { M2Assumptions } from "./assumptions";
import {
  cellKey,
  COLUMN_IDS,
  columnIdToIndex,
  type ColumnId,
  type Level,
  type PlayerId,
} from "./board";
import { bankPayToPlayer } from "./bank";
import { getBuildMoneyPayout } from "./economy";
import type { MatchState } from "./match";

export interface PayoutLine {
  readonly playerId: PlayerId;
  readonly kind: "normal" | "extra";
  readonly column: ColumnId;
  readonly level: Level;
  readonly amount: number;
  readonly boardOwnerId: PlayerId;
  readonly builtBy: PlayerId;
}

export interface LevelPayoutResult {
  readonly state: MatchState;
  readonly lines: readonly PayoutLine[];
  readonly totalPaid: number;
  readonly totalShortfall: number;
  readonly note: string;
}

/**
 * Collect Normal + Extra payout lines for the active level (ASSUMPTION A3–A5, A13).
 * Normal: each built cell on that level pays calculating rate to the **board owner**.
 * Extra: each cell built by someone other than the board owner pays calculating rate
 *        to the **builder**. Client: Extra is **without limit** (no tier table).
 */
export function collectPayoutLinesForLevel(
  state: MatchState,
  level: Level,
): PayoutLine[] {
  const lines: PayoutLine[] = [];
  const extraMult = M2Assumptions.extraLimitSchemeMultiplier;

  for (const player of state.players) {
    for (const column of COLUMN_IDS) {
      const key = cellKey(column, level);
      const cell = player.board.cells[key];
      if (!cell || cell.kind !== "built") continue;

      const rate = getBuildMoneyPayout(columnIdToIndex(column), level);

      lines.push({
        playerId: player.id,
        kind: "normal",
        column,
        level,
        amount: rate,
        boardOwnerId: player.id,
        builtBy: cell.builtBy,
      });

      if (cell.builtBy !== player.id) {
        const extra = Math.floor(rate * extraMult);
        lines.push({
          playerId: cell.builtBy,
          kind: "extra",
          column,
          level,
          amount: extra,
          boardOwnerId: player.id,
          builtBy: cell.builtBy,
        });
      }
    }
  }

  return lines;
}

/**
 * Action 5 — return money depending on level (Normal + Extra), Bank → players.
 */
export function returnMoneyForActiveLevel(
  state: MatchState,
  level: Level = state.levelTurn.activeLevel,
): LevelPayoutResult {
  const lines = collectPayoutLinesForLevel(state, level);
  let next = state;
  let totalPaid = 0;
  let totalShortfall = 0;

  const byPlayer = new Map<PlayerId, number>();
  for (const line of lines) {
    byPlayer.set(line.playerId, (byPlayer.get(line.playerId) ?? 0) + line.amount);
  }

  for (const [playerId, amount] of byPlayer) {
    const result = bankPayToPlayer(next, playerId, amount, "pay-available");
    next = result.state;
    totalPaid += result.paid;
    totalShortfall += result.shortfall;
  }

  const normalCount = lines.filter((l) => l.kind === "normal").length;
  const extraCount = lines.filter((l) => l.kind === "extra").length;
  const note =
    lines.length === 0
      ? `No builds on L${level} — no returns.`
      : `L${level} returns: ${normalCount} Normal + ${extraCount} Extra; paid ${totalPaid}` +
        (totalShortfall > 0 ? ` (shortfall ${totalShortfall})` : "") +
        ".";

  return { state: next, lines, totalPaid, totalShortfall, note };
}

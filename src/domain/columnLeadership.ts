import {
  cellKey,
  columnIdToIndex,
  type ColumnId,
  type Level,
  type PlayerId,
} from "./board";
import { getBuildCost } from "./economy";
import { getPlayer, type MatchState } from "./match";

/**
 * Highest built level in `column` on boards not owned by `playerId`.
 * Returns 0 if no opponent has a build in that column.
 */
export function highestOpponentBuildInColumn(
  state: MatchState,
  playerId: PlayerId,
  column: ColumnId,
): number {
  let highest = 0;
  for (const player of state.players) {
    if (player.id === playerId) continue;
    for (let level = 1; level <= 5; level += 1) {
      const cell = player.board.cells[cellKey(column, level as Level)];
      if (cell?.kind === "built" && level > highest) {
        highest = level;
      }
    }
  }
  return highest;
}

/** Highest built level this player currently has in `column` (0 if none). */
export function highestOwnBuildInColumn(
  state: MatchState,
  playerId: PlayerId,
  column: ColumnId,
): number {
  const player = getPlayer(state, playerId);
  let highest = 0;
  for (let level = 1; level <= 5; level += 1) {
    const cell = player.board.cells[cellKey(column, level as Level)];
    if (cell?.kind === "built" && level > highest) {
      highest = level;
    }
  }
  return highest;
}

/**
 * True while the player currently leads the column (own max > all rivals).
 * Client: benefit has no turn limit while the higher build exists; if the build
 * is gone and you are lower again, the normal “pay more” rule activates again.
 */
export function isColumnLeader(
  state: MatchState,
  playerId: PlayerId,
  column: ColumnId,
): boolean {
  const own = highestOwnBuildInColumn(state, playerId, column);
  if (own <= 0) return false;
  return own > highestOpponentBuildInColumn(state, playerId, column);
}

/**
 * Client: if you build higher than other players in that column, you don't pay more.
 * Without turn/use limit while that lead holds. Evaluated live from board state —
 * if your higher build is removed and you are lower again, full costs apply until
 * you lead again.
 *
 * Cost reading: charge min(full level cost, cost of rivalMax+1) when placeLevel > rivalMax.
 */
export function resolveBuildCostWithColumnRule(
  state: MatchState,
  builderId: PlayerId,
  column: ColumnId,
  placeLevel: Level,
): {
  readonly cost: number;
  readonly fullCost: number;
  readonly columnLeaderDiscount: boolean;
  readonly note: string;
} {
  const colIndex = columnIdToIndex(column);
  const fullCost = getBuildCost(colIndex, placeLevel);
  const rivalMax = highestOpponentBuildInColumn(state, builderId, column);

  if (rivalMax > 0 && placeLevel > rivalMax) {
    const stepLevel = Math.min(5, rivalMax + 1) as Level;
    const discounted = getBuildCost(colIndex, stepLevel);
    if (discounted < fullCost) {
      return {
        cost: discounted,
        fullCost,
        columnLeaderDiscount: true,
        note: `Column lead (rivals max L${rivalMax}): pay L${stepLevel} cost ${discounted} instead of L${placeLevel} ${fullCost}. Lead lasts while this higher build stands; if removed and you are lower again, full cost reactivates.`,
      };
    }
  }

  return {
    cost: fullCost,
    fullCost,
    columnLeaderDiscount: false,
    note: "",
  };
}

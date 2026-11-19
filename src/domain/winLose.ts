import {
  refreshScorePeaks,
  scoreForPlayer,
  type MatchState,
} from "./match";
import type { PlayerId } from "./board";

export type PlayerOutcome =
  | { readonly status: "playing" }
  | { readonly status: "lost"; readonly reason: string }
  | { readonly status: "winner"; readonly points: number; readonly reason: string }
  | { readonly status: "special-end-winner"; readonly points: number };

export interface MatchOutcomeSummary {
  readonly byPlayer: Readonly<Record<PlayerId, PlayerOutcome>>;
  readonly specialEndTriggered: boolean;
  readonly specialEndWinnerId: PlayerId | null;
  readonly pointsWinnerId: PlayerId | null;
  readonly note: string;
  readonly state: MatchState;
}

function totalSpecialCardsRemaining(state: MatchState): number {
  const inDecks =
    state.cards.decks.remaining[1].length +
    state.cards.decks.remaining[2].length +
    state.cards.decks.remaining[3].length;
  const inHands = Object.values(state.cards.hands).reduce(
    (sum, hand) => sum + (hand?.length ?? 0),
    0,
  );
  return inDecks + inHands;
}

/** Among candidates, pick highest score; tie → first who reached that score (earlier peak turn). */
export function pickFirstOnTop(
  state: MatchState,
  candidateIds: readonly PlayerId[],
): PlayerId | null {
  let best: {
    id: PlayerId;
    points: number;
    peakTurn: number;
    order: number;
  } | null = null;

  for (const id of candidateIds) {
    const player = state.players.find((p) => p.id === id);
    if (!player) continue;
    const points = scoreForPlayer(state, id);
    const order = state.playerOrder.indexOf(id);
    const peakTurn = player.scorePeakTurnIndex;
    if (
      !best ||
      points > best.points ||
      (points === best.points && peakTurn < best.peakTurn) ||
      (points === best.points &&
        peakTurn === best.peakTurn &&
        order < best.order)
    ) {
      best = { id, points, peakTurn, order };
    }
  }
  return best?.id ?? null;
}

/**
 * Client D–F: 70 pts → you are the winner; ties → first on top.
 */
export function evaluateMatchOutcomes(state: MatchState): MatchOutcomeSummary {
  const peaked = refreshScorePeaks(state);
  const byPlayer: Record<string, PlayerOutcome> = {};
  const threshold = peaked.rules.pointsThresholdForFinalOptions;

  const aliveIds: PlayerId[] = [];
  for (const player of peaked.players) {
    if (peaked.rules.loseOnZeroLives && player.lives <= 0) {
      byPlayer[player.id] = {
        status: "lost",
        reason: "Lives reached 0.",
      };
      continue;
    }
    if (player.cash <= peaked.rules.loseOnCashAtOrBelow) {
      byPlayer[player.id] = {
        status: "lost",
        reason: `Cash ≤ ${peaked.rules.loseOnCashAtOrBelow}.`,
      };
      continue;
    }
    aliveIds.push(player.id);
    byPlayer[player.id] = { status: "playing" };
  }

  const atThreshold = aliveIds.filter(
    (id) => scoreForPlayer(peaked, id) >= threshold,
  );
  let pointsWinnerId: PlayerId | null = null;
  if (atThreshold.length > 0) {
    pointsWinnerId = pickFirstOnTop(peaked, atThreshold);
    if (pointsWinnerId) {
      byPlayer[pointsWinnerId] = {
        status: "winner",
        points: scoreForPlayer(peaked, pointsWinnerId),
        reason: `Reached ${threshold}+ points (first on top if tied).`,
      };
    }
  }

  const specialEndTriggered = totalSpecialCardsRemaining(peaked) === 0;
  let specialEndWinnerId: PlayerId | null = null;
  if (specialEndTriggered && !pointsWinnerId) {
    specialEndWinnerId = pickFirstOnTop(peaked, aliveIds);
    if (specialEndWinnerId) {
      byPlayer[specialEndWinnerId] = {
        status: "special-end-winner",
        points: scoreForPlayer(peaked, specialEndWinnerId),
      };
    }
  }

  const lost = Object.values(byPlayer).filter((o) => o.status === "lost").length;
  const winners = Object.values(byPlayer).filter(
    (o) => o.status === "winner" || o.status === "special-end-winner",
  ).length;
  const note = specialEndTriggered
    ? `Special end (0 special cards). Winner: ${specialEndWinnerId ?? "none"}.`
    : pointsWinnerId
      ? `Winner: ${pointsWinnerId} (≥${threshold} pts).`
      : `Outcomes: ${lost} lost, ${winners} winners.`;

  return {
    byPlayer,
    specialEndTriggered,
    specialEndWinnerId,
    pointsWinnerId,
    note,
    state: peaked,
  };
}

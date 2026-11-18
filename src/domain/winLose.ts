import { scoreForPlayer, type MatchState } from "./match";
import type { PlayerId } from "./board";

export type PlayerOutcome =
  | { readonly status: "playing" }
  | { readonly status: "lost"; readonly reason: string }
  | { readonly status: "final-options"; readonly points: number }
  | { readonly status: "special-end-winner"; readonly points: number };

export interface MatchOutcomeSummary {
  readonly byPlayer: Readonly<Record<PlayerId, PlayerOutcome>>;
  readonly specialEndTriggered: boolean;
  readonly specialEndWinnerId: PlayerId | null;
  readonly note: string;
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

/**
 * Evaluate win/lose thresholds after a turn or significant action.
 * Final-options menu content remains a UI stub (OPEN).
 */
export function evaluateMatchOutcomes(state: MatchState): MatchOutcomeSummary {
  const byPlayer: Record<string, PlayerOutcome> = {};
  const threshold = state.rules.pointsThresholdForFinalOptions;

  for (const player of state.players) {
    if (state.rules.loseOnZeroLives && player.lives <= 0) {
      byPlayer[player.id] = {
        status: "lost",
        reason: "Lives reached 0.",
      };
      continue;
    }
    if (player.cash <= state.rules.loseOnCashAtOrBelow) {
      byPlayer[player.id] = {
        status: "lost",
        reason: `Cash ≤ ${state.rules.loseOnCashAtOrBelow}.`,
      };
      continue;
    }
    const points = scoreForPlayer(state, player.id);
    if (points >= threshold) {
      byPlayer[player.id] = { status: "final-options", points };
      continue;
    }
    byPlayer[player.id] = { status: "playing" };
  }

  const specialEndTriggered = totalSpecialCardsRemaining(state) === 0;
  let specialEndWinnerId: PlayerId | null = null;
  if (specialEndTriggered) {
    let best: { id: PlayerId; points: number } | null = null;
    for (const player of state.players) {
      if (byPlayer[player.id]?.status === "lost") continue;
      const points = scoreForPlayer(state, player.id);
      if (!best || points > best.points) {
        best = { id: player.id, points };
      }
    }
    if (best) {
      specialEndWinnerId = best.id;
      byPlayer[best.id] = {
        status: "special-end-winner",
        points: best.points,
      };
    }
  }

  const lost = Object.values(byPlayer).filter((o) => o.status === "lost").length;
  const finals = Object.values(byPlayer).filter(
    (o) => o.status === "final-options",
  ).length;
  const note = specialEndTriggered
    ? `Special end (0 special cards). Winner: ${specialEndWinnerId ?? "none"}.`
    : `Outcomes: ${lost} lost, ${finals} at final-options (≥${threshold} pts).`;

  return { byPlayer, specialEndTriggered, specialEndWinnerId, note };
}

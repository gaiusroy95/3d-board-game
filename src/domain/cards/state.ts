import type { PlayerId } from "../board";
import { cardsForDeck, type DeckId } from "./catalog";

export interface PlayerHandCard {
  readonly instanceId: string;
  readonly cardId: string;
  readonly deckId: DeckId;
  readonly purchasePrice: number;
}

export interface SharedDecksState {
  readonly remaining: Readonly<Record<DeckId, readonly string[]>>;
  readonly recyclePouch: readonly { cardId: string; deckId: DeckId }[];
  readonly playsFromDeck: Readonly<Record<DeckId, number>>;
  readonly unlocked: Readonly<Record<DeckId, boolean>>;
}

export interface MatchCardsState {
  readonly decks: SharedDecksState;
  readonly hands: Readonly<Record<PlayerId, readonly PlayerHandCard[]>>;
  readonly nextInstanceSeq: number;
}

function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}

export function createInitialCardsState(
  playerIds: readonly PlayerId[],
  options?: { shuffle?: boolean },
): MatchCardsState {
  const remaining: Record<DeckId, string[]> = {
    1: cardsForDeck(1).map((c) => c.id),
    2: cardsForDeck(2).map((c) => c.id),
    3: cardsForDeck(3).map((c) => c.id),
  };

  if (options?.shuffle !== false) {
    shuffleInPlace(remaining[1]);
    shuffleInPlace(remaining[2]);
    shuffleInPlace(remaining[3]);
  }

  const hands: Record<string, PlayerHandCard[]> = {};
  for (const id of playerIds) {
    hands[id] = [];
  }

  return {
    decks: {
      remaining,
      recyclePouch: [],
      playsFromDeck: { 1: 0, 2: 0, 3: 0 },
      unlocked: { 1: true, 2: false, 3: false },
    },
    hands,
    nextInstanceSeq: 1,
  };
}

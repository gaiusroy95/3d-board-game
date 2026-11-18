/**
 * Full special-card catalog from client files under dev-brief/card/.
 * Deck sizes: 60 / 65 / 65 (client correction).
 */

import { COLUMN_IDS, type ColumnId } from "../board";

export type DeckId = 1 | 2 | 3;

export type CardEffect =
  | {
      readonly type: "column-master";
      readonly column: ColumnId;
      readonly rankUp: 2 | 3 | 4;
    }
  | {
      readonly type: "column-hammer";
      readonly column: ColumnId;
      readonly rankDown: 2 | 3 | 4;
    }
  | { readonly type: "money-maker"; readonly amount: number }
  | { readonly type: "healer"; readonly lives: number }
  | { readonly type: "skill-class"; readonly reuseSkills: number }
  | { readonly type: "get-rich"; readonly rewardCount: number }
  | {
      readonly type: "reactivate-figurine";
      /** 0-based slot indices that may be unlocked. */
      readonly unlockSlots: readonly number[];
    };

export interface CardDefinition {
  readonly id: string;
  readonly name: string;
  readonly deckId: DeckId;
  readonly effect: CardEffect;
  readonly description: string;
}

export const DECK_PRICE: Record<DeckId, number> = {
  1: 4000,
  2: 6000,
  3: 8000,
};

/** Client correction: 60 / 65 / 65. */
export const DECK_SIZE: Record<DeckId, number> = {
  1: 60,
  2: 65,
  3: 65,
};

export const RECYCLE_REFUND_RATE = 0.3;
export const PLAYS_TO_UNLOCK_NEXT = 10;

const COLUMN_TITLE: Record<ColumnId, string> = {
  wine: "Wine",
  rum: "Rum",
  tequila: "Tequila",
  vodka: "Vodka",
  whisky: "Whisky",
};

function mastersForDeck(deckId: DeckId, rankUp: 2 | 3 | 4): CardDefinition[] {
  const cards: CardDefinition[] = [];
  let n = 1;
  for (const column of COLUMN_IDS) {
    for (let copy = 1; copy <= 4; copy += 1) {
      cards.push({
        id: `d${deckId}-master-${column}-${copy}`,
        name: `${COLUMN_TITLE[column]} Master`,
        deckId,
        effect: { type: "column-master", column, rankUp },
        description: `Rank up ${rankUp} levels on ${column}; can unblock a blocked level. Over-L5 build: value×excess for 1 turn.`,
      });
      n += 1;
    }
  }
  void n;
  return cards;
}

function hammersForDeck(deckId: DeckId, rankDown: 2 | 3 | 4): CardDefinition[] {
  const cards: CardDefinition[] = [];
  for (const column of COLUMN_IDS) {
    for (let copy = 1; copy <= 4; copy += 1) {
      cards.push({
        id: `d${deckId}-hammer-${column}-${copy}`,
        name: `${COLUMN_TITLE[column]} Hammer`,
        deckId,
        effect: { type: "column-hammer", column, rankDown },
        description: `Rank down ${rankDown} levels on ${column}. Under level 0 → lose 1 life. Negative build pays L1 cost × depth to Bank.`,
      });
    }
  }
  return cards;
}

function copies(
  count: number,
  deckId: DeckId,
  key: string,
  name: string,
  effect: CardEffect,
  description: string,
): CardDefinition[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `d${deckId}-${key}-${i + 1}`,
    name,
    deckId,
    effect,
    description,
  }));
}

function specialsForDeck(deckId: DeckId): CardDefinition[] {
  const money = deckId === 1 ? 10500 : deckId === 2 ? 14000 : 17500;
  const reuse = deckId as 1 | 2 | 3;
  const rich = deckId as 1 | 2 | 3;
  const cards: CardDefinition[] = [
    ...copies(
      5,
      deckId,
      "money-maker",
      "Money Maker",
      { type: "money-maker", amount: money },
      `Boost cash: add ${money}.`,
    ),
    ...copies(
      5,
      deckId,
      "healer",
      "Healer",
      { type: "healer", lives: 1 },
      "Boost lives: +1 life.",
    ),
    ...copies(
      5,
      deckId,
      "skill-class",
      "Skill Class",
      { type: "skill-class", reuseSkills: reuse },
      `Activate/reuse ${reuse} skill(s).`,
    ),
    ...copies(
      5,
      deckId,
      "get-rich",
      "Get Rich",
      { type: "get-rich", rewardCount: rich },
      `Obtain ${rich} reward(s) from a figurine you choose.`,
    ),
  ];

  if (deckId === 2) {
    cards.push(
      ...copies(
        5,
        deckId,
        "reactivate-fig",
        "Reactivate Figurine",
        { type: "reactivate-figurine", unlockSlots: [3] },
        "Unlock 4th figurine; second use: get reward and reuse skill.",
      ),
    );
  }
  if (deckId === 3) {
    cards.push(
      ...copies(
        5,
        deckId,
        "reactivate-fig",
        "Reactivate Figurine",
        { type: "reactivate-figurine", unlockSlots: [4, 5] },
        "Unlock 5th and/or 6th figurine; second use: get reward and reuse skill.",
      ),
    );
  }

  return cards;
}

export const CARD_CATALOG: readonly CardDefinition[] = [
  ...mastersForDeck(1, 2),
  ...hammersForDeck(1, 2),
  ...specialsForDeck(1),
  ...mastersForDeck(2, 3),
  ...hammersForDeck(2, 3),
  ...specialsForDeck(2),
  ...mastersForDeck(3, 4),
  ...hammersForDeck(3, 4),
  ...specialsForDeck(3),
];

export function getCardDefinition(cardId: string): CardDefinition | undefined {
  return CARD_CATALOG.find((c) => c.id === cardId);
}

export function cardsForDeck(deckId: DeckId): CardDefinition[] {
  return CARD_CATALOG.filter((c) => c.deckId === deckId);
}

/** Sanity: catalog must match client deck sizes. */
export function assertCatalogSizes(): void {
  for (const deckId of [1, 2, 3] as DeckId[]) {
    const n = cardsForDeck(deckId).length;
    if (n !== DECK_SIZE[deckId]) {
      throw new Error(`Deck ${deckId} catalog size ${n} ≠ ${DECK_SIZE[deckId]}`);
    }
  }
}

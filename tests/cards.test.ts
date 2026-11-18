import { describe, expect, it } from "vitest";
import {
  assertCatalogSizes,
  buyCardFromDeck,
  cardsForDeck,
  DECK_SIZE,
  playSpecialCard,
  recycleCard,
  resolvePendingColumnCard,
} from "@domain/cards";
import { createFourPlayerMatch, type MatchState } from "@domain/match";

function richMatch(): MatchState {
  const match = createFourPlayerMatch({
    matchId: "cards",
    players: [
      { id: "p1", displayName: "A" },
      { id: "p2", displayName: "B" },
      { id: "p3", displayName: "C" },
      { id: "p4", displayName: "D" },
    ],
  });
  return {
    ...match,
    bankBalance: 50_000,
    players: match.players.map((p) =>
      p.id === "p1" ? { ...p, cash: 50_000 } : p,
    ),
  };
}

describe("M2 cards from client dump", () => {
  it("catalog matches deck sizes 60/65/65", () => {
    expect(cardsForDeck(1)).toHaveLength(60);
    expect(cardsForDeck(2)).toHaveLength(65);
    expect(cardsForDeck(3)).toHaveLength(65);
    expect(DECK_SIZE[1]).toBe(60);
    expect(DECK_SIZE[2]).toBe(65);
    expect(DECK_SIZE[3]).toBe(65);
    expect(() => assertCatalogSizes()).not.toThrow();
  });

  it("buys a Deck1 card for 4000", () => {
    const bought = buyCardFromDeck(richMatch(), "p1", 1);
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    expect(bought.state.players[0]!.cash).toBe(46_000);
    expect(bought.state.cards.hands.p1).toHaveLength(1);
    expect(bought.state.cards.decks.remaining[1]).toHaveLength(59);
  });

  it("unlocks Deck2 after 10 Deck1 plays", () => {
    let match: MatchState = richMatch();
    for (let i = 0; i < 10; i += 1) {
      const bought = buyCardFromDeck(match, "p1", 1);
      expect(bought.ok).toBe(true);
      if (!bought.ok) return;
      match = bought.state;
      const card = match.cards.hands.p1![0]!;
      const played = playSpecialCard(match, "p1", card.instanceId);
      expect(played.ok).toBe(true);
      if (!played.ok) return;
      match = {
        ...played.state,
        players: played.state.players.map((p) =>
          p.id === "p1" ? { ...p, specialCardsPlayedThisTurn: 0 } : p,
        ),
      };
    }
    expect(match.cards.decks.unlocked[2]).toBe(true);
  });

  it("recycles for 0.3 × purchase price", () => {
    let match: MatchState = richMatch();
    const bought = buyCardFromDeck(match, "p1", 1);
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    match = bought.state;
    const card = match.cards.hands.p1![0]!;
    const recycled = recycleCard(match, "p1", card.instanceId);
    expect(recycled.ok).toBe(true);
    if (!recycled.ok) return;
    expect(recycled.state.players[0]!.cash).toBe(46_000 + 1200);
  });

  it("Money Maker adds cash", () => {
    let match: MatchState = richMatch();
    // Force a money-maker into hand
    const moneyId = "d1-money-maker-1";
    match = {
      ...match,
      cards: {
        ...match.cards,
        hands: {
          ...match.cards.hands,
          p1: [
            {
              instanceId: "inst-mm",
              cardId: moneyId,
              deckId: 1,
              purchasePrice: 4000,
            },
          ],
        },
      },
    };
    const played = playSpecialCard(match, "p1", "inst-mm");
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.state.players[0]!.cash).toBe(50_000 + 10500);
  });

  it("Master card pending resolves onto selected column", () => {
    let match: MatchState = richMatch();
    match = {
      ...match,
      cards: {
        ...match.cards,
        hands: {
          ...match.cards.hands,
          p1: [
            {
              instanceId: "inst-m",
              cardId: "d1-master-wine-1",
              deckId: 1,
              purchasePrice: 4000,
            },
          ],
        },
      },
    };
    const played = playSpecialCard(match, "p1", "inst-m");
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.state.players[0]!.pendingColumnCard?.kind).toBe("column-master");

    const resolved = resolvePendingColumnCard(played.state, "p1", "p1", "wine");
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.state.players[0]!.board.cells["wine:2"]?.kind).toBe("built");
  });
});

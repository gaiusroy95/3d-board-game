import { M2Assumptions } from "../assumptions";
import { bankPayToPlayer, bankReceivePayment } from "../bank";
import type { PlayerId } from "../board";
import { getPlayer, type MatchState, type PlayerMatchState } from "../match";
import {
  DECK_PRICE,
  getCardDefinition,
  PLAYS_TO_UNLOCK_NEXT,
  RECYCLE_REFUND_RATE,
  type CardEffect,
  type DeckId,
} from "./catalog";
import {
  createInitialCardsState,
  type MatchCardsState,
  type PlayerHandCard,
} from "./state";
import { recordSpecialCardPlayed } from "../objectives";
import { applyColumnHammer, applyColumnMaster } from "./columnEffects";

export type { MatchCardsState, PlayerHandCard } from "./state";
export { createInitialCardsState } from "./state";

export type CardActionResult =
  | { readonly ok: true; readonly state: MatchState; readonly note: string }
  | { readonly ok: false; readonly state: MatchState; readonly reason: string };

function withCards(
  state: MatchState,
  cards: MatchCardsState,
  players?: readonly PlayerMatchState[],
  bankBalance?: number,
): MatchState {
  return {
    ...state,
    players: players ?? state.players,
    bankBalance: bankBalance ?? state.bankBalance,
    cards,
  };
}

export function buyCardFromDeck(
  state: MatchState,
  playerId: PlayerId,
  deckId: DeckId,
): CardActionResult {
  const decks = state.cards.decks;

  if (!decks.unlocked[deckId]) {
    return {
      ok: false,
      state,
      reason: `Deck ${deckId} is locked. Play ${PLAYS_TO_UNLOCK_NEXT} cards from the previous deck.`,
    };
  }

  const pile = decks.remaining[deckId];
  if (pile.length === 0) {
    return { ok: false, state, reason: `Deck ${deckId} is empty.` };
  }

  const price = DECK_PRICE[deckId];
  const player = getPlayer(state, playerId);
  if (player.cash < price) {
    return {
      ok: false,
      state,
      reason: `Need ${price} cash to buy from Deck ${deckId}; have ${player.cash}.`,
    };
  }

  const cardId = pile[0]!;
  const rest = pile.slice(1);
  const nextPlayers: PlayerMatchState[] = state.players.map((p) =>
    p.id === playerId ? { ...p, cash: p.cash - price } : p,
  );

  const afterPay = bankReceivePayment({ ...state, players: nextPlayers }, price);

  const cards: MatchCardsState = {
    ...state.cards,
    decks: {
      ...decks,
      remaining: { ...decks.remaining, [deckId]: rest },
    },
    nextInstanceSeq: state.cards.nextInstanceSeq + 1,
    hands: {
      ...state.cards.hands,
      [playerId]: [
        ...(state.cards.hands[playerId] ?? []),
        {
          instanceId: `inst-${state.cards.nextInstanceSeq}`,
          cardId,
          deckId,
          purchasePrice: price,
        },
      ],
    },
  };

  return {
    ok: true,
    state: withCards(afterPay, cards),
    note: `Bought ${cardId} from Deck ${deckId} for ${price}.`,
  };
}

function applyInstantEffect(
  state: MatchState,
  playerId: PlayerId,
  effect: CardEffect,
  cardName: string,
): CardActionResult {
  switch (effect.type) {
    case "money-maker": {
      let funded = state;
      if (funded.bankBalance < effect.amount) {
        funded = { ...funded, bankBalance: effect.amount };
      }
      const paid = bankPayToPlayer(funded, playerId, effect.amount, "pay-available");
      return {
        ok: true,
        state: paid.state,
        note: `${cardName}: +${paid.paid} cash.`,
      };
    }
    case "healer": {
      const nextPlayers = state.players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              lives: p.lives + effect.lives,
              livesGainedExtra: p.livesGainedExtra + effect.lives,
            }
          : p,
      );
      return {
        ok: true,
        state: { ...state, players: nextPlayers },
        note: `${cardName}: +${effect.lives} life.`,
      };
    }
    case "skill-class": {
      const nextPlayers = state.players.map((p) =>
        p.id === playerId
          ? { ...p, skillReusesRemaining: p.skillReusesRemaining + effect.reuseSkills }
          : p,
      );
      return {
        ok: true,
        state: { ...state, players: nextPlayers },
        note: `${cardName}: ${effect.reuseSkills} skill reuse(s) available.`,
      };
    }
    case "get-rich": {
      const nextPlayers = state.players.map((p) =>
        p.id === playerId
          ? { ...p, pendingGetRichRewards: p.pendingGetRichRewards + effect.rewardCount }
          : p,
      );
      return {
        ok: true,
        state: { ...state, players: nextPlayers },
        note: `${cardName}: choose figurine for ${effect.rewardCount} reward(s).`,
      };
    }
    case "reactivate-figurine": {
      const player = getPlayer(state, playerId);
      const maxSlot = Math.max(...effect.unlockSlots);
      const newOwned = Math.max(player.ownedFigurines, maxSlot + 1);
      const skills = [...player.figurineSkills];
      for (const slot of effect.unlockSlots) {
        if (!skills.some((s) => s.slotIndex === slot)) {
          skills.push({ slotIndex: slot, skill1Learned: false, skill2Learned: false });
        }
      }
      const nextPlayers = state.players.map((p) =>
        p.id === playerId
          ? { ...p, ownedFigurines: newOwned, figurineSkills: skills }
          : p,
      );
      return {
        ok: true,
        state: { ...state, players: nextPlayers },
        note: `${cardName}: unlocked figurine slot(s) ${effect.unlockSlots.map((s) => s + 1).join(",")}.`,
      };
    }
    case "column-master":
    case "column-hammer": {
      const pending = {
        kind: effect.type,
        column: effect.column,
        amount:
          effect.type === "column-master" ? effect.rankUp : effect.rankDown,
        cardName,
      };
      const nextPlayers = state.players.map((p) =>
        p.id === playerId ? { ...p, pendingColumnCard: pending } : p,
      );
      return {
        ok: true,
        state: { ...state, players: nextPlayers },
        note: `${cardName}: select a ${effect.column} cell (any board) to resolve.`,
      };
    }
    default:
      return { ok: true, state, note: `${cardName}: no instant effect.` };
  }
}

export function playSpecialCard(
  state: MatchState,
  playerId: PlayerId,
  instanceId: string,
): CardActionResult {
  const hand = state.cards.hands[playerId] ?? [];
  const card = hand.find((c) => c.instanceId === instanceId);
  if (!card) {
    return { ok: false, state, reason: "Card not in hand." };
  }

  const player = getPlayer(state, playerId);
  const limit = player.maxSpecialCardsThisTurn || M2Assumptions.maxSpecialCardsPlayedPerTurn;
  if (player.specialCardsPlayedThisTurn >= limit) {
    return {
      ok: false,
      state,
      reason: `Already played ${limit} special cards this turn.`,
    };
  }

  const def = getCardDefinition(card.cardId);
  if (!def) {
    return { ok: false, state, reason: `Unknown card ${card.cardId}.` };
  }

  const nextHand = hand.filter((c) => c.instanceId !== instanceId);
  const playsFromDeck = {
    ...state.cards.decks.playsFromDeck,
    [card.deckId]: state.cards.decks.playsFromDeck[card.deckId] + 1,
  };
  const unlocked = { ...state.cards.decks.unlocked };
  if (playsFromDeck[1] >= PLAYS_TO_UNLOCK_NEXT) unlocked[2] = true;
  if (playsFromDeck[2] >= PLAYS_TO_UNLOCK_NEXT) unlocked[3] = true;

  const cards: MatchCardsState = {
    ...state.cards,
    hands: { ...state.cards.hands, [playerId]: nextHand },
    decks: {
      ...state.cards.decks,
      playsFromDeck,
      unlocked,
      recyclePouch: [
        ...state.cards.decks.recyclePouch,
        { cardId: card.cardId, deckId: card.deckId },
      ],
    },
  };

  const counted: MatchState = {
    ...state,
    cards,
    players: state.players.map((p) =>
      p.id === playerId
        ? { ...p, specialCardsPlayedThisTurn: p.specialCardsPlayedThisTurn + 1 }
        : p,
    ),
  };

  const applied = applyInstantEffect(counted, playerId, def.effect, def.name);
  if (!applied.ok) return applied;

  const withStats = recordSpecialCardPlayed(applied.state, playerId);
  return {
    ok: true,
    state: withStats,
    note: `Played ${def.name}. ${applied.note}`,
  };
}

/**
 * Resolve a pending Master/Hammer using a selected board cell.
 * Column on the card must match the selected cell's column.
 */
export function resolvePendingColumnCard(
  state: MatchState,
  playerId: PlayerId,
  targetOwnerId: PlayerId,
  column: import("../board").ColumnId,
): CardActionResult {
  const player = getPlayer(state, playerId);
  const pending = player.pendingColumnCard;
  if (!pending) {
    return { ok: false, state, reason: "No pending column card." };
  }
  if (pending.column !== column) {
    return {
      ok: false,
      state,
      reason: `Card requires column ${pending.column}; selected ${column}.`,
    };
  }

  const cleared: MatchState = {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId ? { ...p, pendingColumnCard: null } : p,
    ),
  };

  if (pending.kind === "column-master") {
    return applyColumnMaster(
      cleared,
      playerId,
      targetOwnerId,
      column,
      pending.amount,
    );
  }
  return applyColumnHammer(
    cleared,
    playerId,
    targetOwnerId,
    column,
    pending.amount,
  );
}

export function recycleCard(
  state: MatchState,
  playerId: PlayerId,
  instanceId: string,
): CardActionResult {
  const hand = state.cards.hands[playerId] ?? [];
  const card = hand.find((c) => c.instanceId === instanceId);
  if (!card) {
    return { ok: false, state, reason: "Card not in hand." };
  }

  const refund = Math.floor(card.purchasePrice * RECYCLE_REFUND_RATE);
  const nextHand = hand.filter((c) => c.instanceId !== instanceId);
  const cards: MatchCardsState = {
    ...state.cards,
    hands: { ...state.cards.hands, [playerId]: nextHand },
    decks: {
      ...state.cards.decks,
      recyclePouch: [
        ...state.cards.decks.recyclePouch,
        { cardId: card.cardId, deckId: card.deckId },
      ],
    },
  };

  const withHand = withCards(state, cards);
  const paid = bankPayToPlayer(withHand, playerId, refund, "pay-available");

  return {
    ok: true,
    state: {
      ...paid.state,
      cards,
      recycleUses: paid.state.recycleUses + 1,
    },
    note:
      `Recycled ${card.cardId}; refund ${paid.paid}` +
      (paid.shortfall > 0 ? ` (shortfall ${paid.shortfall})` : "") +
      ".",
  };
}

export function emptyCardsForPlayers(playerIds: readonly PlayerId[]): MatchCardsState {
  return createInitialCardsState(playerIds, { shuffle: false });
}

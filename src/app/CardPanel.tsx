import {
  buyCardFromDeck,
  DECK_PRICE,
  getCardDefinition,
  playSpecialCard,
  recycleCard,
  resolvePendingColumnCard,
  type DeckId,
} from "@domain/cards";
import { getActivePlayerId, type MatchState } from "@domain/match";
import type { CellSelection } from "./matchUi";

interface CardPanelProps {
  match: MatchState;
  selectedCell: CellSelection | null;
  onMatchChange: (match: MatchState, note: string) => void;
}

export function CardPanel({ match, selectedCell, onMatchChange }: CardPanelProps) {
  const activeId = getActivePlayerId(match);
  const active = match.players.find((p) => p.id === activeId);
  const hand = match.cards.hands[activeId] ?? [];
  const decks = match.cards.decks;
  const pending = active?.pendingColumnCard ?? null;

  const buy = (deckId: DeckId) => {
    const result = buyCardFromDeck(match, activeId, deckId);
    onMatchChange(
      result.state,
      result.ok ? result.note : result.reason,
    );
  };

  return (
    <section className="side-panel card-panel" aria-label="Special cards">
      <h3>Special decks</h3>
      <p className="muted tiny">Buy from the shared street decks. Play up to 4 per turn.</p>
      <div className="deck-row">
        {([1, 2, 3] as DeckId[]).map((deckId) => (
          <button
            key={deckId}
            type="button"
            className="hud-button"
            disabled={!decks.unlocked[deckId] || decks.remaining[deckId].length === 0}
            title={
              decks.unlocked[deckId]
                ? `${decks.remaining[deckId].length} left @ ${DECK_PRICE[deckId]}`
                : "Locked"
            }
            onClick={() => buy(deckId)}
          >
            Buy D{deckId} ({DECK_PRICE[deckId]})
            {!decks.unlocked[deckId] ? " 🔒" : ` · ${decks.remaining[deckId].length}`}
          </button>
        ))}
      </div>
      <p className="muted">
        Plays D1 {decks.playsFromDeck[1]}/10 · D2 {decks.playsFromDeck[2]}/10 · pouch{" "}
        {decks.recyclePouch.length}
      </p>
      {pending && (
        <div className="pending-card">
          <p>
            Pending <strong>{pending.cardName}</strong> ({pending.column}{" "}
            {pending.kind === "column-master" ? `+${pending.amount}` : `−${pending.amount}`}).
            Select a matching column cell, then apply.
          </p>
          <button
            type="button"
            className="hud-button"
            disabled={!selectedCell || selectedCell.position.column !== pending.column}
            onClick={() => {
              if (!selectedCell) return;
              const result = resolvePendingColumnCard(
                match,
                activeId,
                selectedCell.ownerId,
                selectedCell.position.column,
              );
              onMatchChange(
                result.state,
                result.ok ? result.note : result.reason,
              );
            }}
          >
            Apply on selected cell
          </button>
        </div>
      )}
      <h4>
        Hand ({hand.length}) — play ≤{active?.maxSpecialCardsThisTurn ?? 4} / turn
      </h4>
      {hand.length === 0 ? (
        <p className="muted">Empty hand.</p>
      ) : (
        <ul className="hand-list">
          {hand.map((card) => {
            const def = getCardDefinition(card.cardId);
            return (
              <li key={card.instanceId}>
                <span>
                  {def?.name ?? card.cardId}{" "}
                  <span className="muted">D{card.deckId}</span>
                </span>
                <span className="hand-actions">
                  <button
                    type="button"
                    className="hud-button compact"
                    onClick={() => {
                      const result = playSpecialCard(match, activeId, card.instanceId);
                      onMatchChange(
                        result.state,
                        result.ok ? result.note : result.reason,
                      );
                    }}
                  >
                    Play
                  </button>
                  <button
                    type="button"
                    className="hud-button compact ghost"
                    onClick={() => {
                      const result = recycleCard(match, activeId, card.instanceId);
                      onMatchChange(
                        result.state,
                        result.ok ? result.note : result.reason,
                      );
                    }}
                  >
                    Recycle
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

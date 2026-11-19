import {
  getActivePlayerId,
  scoreForPlayer,
  type MatchState,
} from "@domain/match";
import type { CellSelection } from "./matchUi";
import { describeCell } from "./matchUi";

interface MatchHudProps {
  match: MatchState;
  selectedCell: CellSelection | null;
  statusMessage: string | null;
  onEndTurn: () => void;
  onBuild: () => void;
  onDestroy: () => void;
  onActivateFigurineDemo: () => void;
  onUnlockFigurine: () => void;
  onBuildBorrow: () => void;
  /** Seconds left on turn timer; null = no timer. */
  turnSecondsLeft?: number | null;
  localPlayerId?: string | null;
}

export function MatchHud({
  match,
  selectedCell,
  statusMessage,
  onEndTurn,
  onBuild,
  onDestroy,
  onActivateFigurineDemo,
  onUnlockFigurine,
  onBuildBorrow,
  turnSecondsLeft = null,
  localPlayerId = null,
}: MatchHudProps) {
  const activeId = getActivePlayerId(match);
  const active = match.players.find((p) => p.id === activeId);
  const canDemoFigurine = (active?.ownedFigurines ?? 0) > 0;
  const timerLabel =
    turnSecondsLeft == null
      ? null
      : `${Math.floor(turnSecondsLeft / 60)}:${String(turnSecondsLeft % 60).padStart(2, "0")}`;

  return (
    <div className="match-hud">
      {timerLabel != null && (
        <p className="turn-timer" aria-live="polite">
          Turn timer <strong>{timerLabel}</strong>
        </p>
      )}
      <ul className="seat-rail" aria-label="Players">
        {match.players.map((player, index) => (
          <li
            key={player.id}
            data-seat={index}
            className={`seat${player.id === activeId ? " is-active" : ""}${
              localPlayerId === player.id ? " is-local" : ""
            }`}
          >
            <span className="seat-name">
              {player.displayName}
              {localPlayerId === player.id ? " (you)" : ""}
            </span>
            <div className="seat-stats">
              <span>
                <strong>{scoreForPlayer(match, player.id)}</strong> pts
              </span>
              <span>
                <strong>{player.cash}</strong> cash
              </span>
              <span>
                <strong>{player.lives}</strong> lives
              </span>
              <span>
                <strong>{player.ownedFigurines}</strong>/7 fig
              </span>
            </div>
          </li>
        ))}
      </ul>

      <div className="action-dock">
        <button type="button" className="hud-button primary" onClick={onBuild}>
          Build
        </button>
        <button type="button" className="hud-button accent" onClick={onEndTurn}>
          End turn
        </button>
        <button
          type="button"
          className="hud-button"
          onClick={onBuildBorrow}
          title="Borrow build cost; repay 20% each turn"
        >
          Build borrow
        </button>
        <button
          type="button"
          className="hud-button"
          onClick={onActivateFigurineDemo}
          disabled={!canDemoFigurine}
        >
          Activate figurine
        </button>
        <button type="button" className="hud-button" onClick={onUnlockFigurine}>
          Unlock figurine
        </button>
        <button type="button" className="hud-button ghost" onClick={onDestroy} disabled>
          Destroy
        </button>
        <span className="selection-chip">
          {selectedCell ? describeCell(selectedCell) : "Select a cell on the table"}
        </span>
      </div>

      {statusMessage && (
        <p className="hud-status" role="status">
          {statusMessage}
        </p>
      )}
    </div>
  );
}

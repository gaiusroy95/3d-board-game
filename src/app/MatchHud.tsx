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
}: MatchHudProps) {
  const activeId = getActivePlayerId(match);
  const active = match.players.find((p) => p.id === activeId);
  const canDemoFigurine = (active?.ownedFigurines ?? 0) > 0;

  return (
    <div className="match-hud">
      <div className="hud-row">
        <div className="hud-chip" aria-live="polite">
          Level-turn <strong>L{match.levelTurn.activeLevel}</strong>
          {" · "}
          Active: <strong>{active?.displayName ?? activeId}</strong>
          {" · "}
          Bank: <strong>{match.bankBalance}</strong>
        </div>
        <button type="button" className="hud-button" onClick={onEndTurn}>
          End turn
        </button>
        <button
          type="button"
          className="hud-button"
          onClick={onActivateFigurineDemo}
          disabled={!canDemoFigurine}
          title="Opens the figurine activation popup for the active player's first owned slot"
        >
          Activate figurine
        </button>
        <button type="button" className="hud-button" onClick={onUnlockFigurine}>
          Unlock figurine
        </button>
      </div>

      <ul className="score-list">
        {match.players.map((player) => (
          <li key={player.id} className={player.id === activeId ? "is-active" : undefined}>
            <span>{player.displayName}</span>
            <span>{scoreForPlayer(match, player.id)} pts</span>
            <span>{player.cash} cash</span>
            <span className="muted">{player.lives} lives</span>
            <span className="muted">{player.ownedFigurines}/7 fig</span>
          </li>
        ))}
      </ul>

      <div className="hud-actions">
        <button
          type="button"
          className="hud-button"
          onClick={onBuild}
          title="Pays cost table into Bank immediately"
        >
          Build
        </button>
        <button
          type="button"
          className="hud-button"
          onClick={onDestroy}
          disabled
          title="Client: Destroy is not a player button"
        >
          Destroy
        </button>
        <button
          type="button"
          className="hud-button"
          onClick={onBuildBorrow}
          title="Borrow build cost; repay 20% of cost each turn (shared cap 3/5/7)"
        >
          Build borrow
        </button>
        <span className="muted">
          Selected: {selectedCell ? describeCell(selectedCell) : "none"}
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

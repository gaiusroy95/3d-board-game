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
}

export function MatchHud({
  match,
  selectedCell,
  statusMessage,
  onEndTurn,
  onBuild,
  onDestroy,
  onActivateFigurineDemo,
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
      </div>

      <ul className="score-list">
        {match.players.map((player) => (
          <li key={player.id} className={player.id === activeId ? "is-active" : undefined}>
            <span>{player.displayName}</span>
            <span>{scoreForPlayer(match, player.id)} pts</span>
            <span className="muted">{player.ownedFigurines}/7 fig</span>
          </li>
        ))}
      </ul>

      <div className="hud-actions">
        <button
          type="button"
          className="hud-button"
          onClick={onBuild}
          title="Build rules partially OPEN — uses no-op policy"
        >
          Build
        </button>
        <button
          type="button"
          className="hud-button"
          onClick={onDestroy}
          title="Destroy rules OPEN — disabled effect"
        >
          Destroy
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

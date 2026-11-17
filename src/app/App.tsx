import { useEffect, useState } from "react";
import { applyBoardInteraction } from "@domain/buildDestroy";
import { canOpenFigurinePopup } from "@domain/figurineActivation";
import {
  advanceTurn,
  createFourPlayerMatch,
  getActivePlayerId,
  type MatchState,
} from "@domain/match";
import { FigurineActivateModal } from "./FigurineActivateModal";
import { GameViewport } from "./GameViewport";
import { MatchHud } from "./MatchHud";
import {
  initialMatchUiState,
  type MatchUiState,
  type PickPayload,
} from "./matchUi";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; match: MatchState }
  | { status: "empty"; message: string }
  | { status: "error"; message: string };

/**
 * Local prototype: authoritative match state + separate UI selection/popup state.
 */
export function App() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [ui, setUi] = useState<MatchUiState>(initialMatchUiState);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const match = createFourPlayerMatch({
          matchId: "local-prototype-1",
          players: [
            {
              id: "p1",
              displayName: "Player 1",
              // Sample owned figurine so activation popup can be opened in the prototype.
              // Unlock conditions remain OPEN — labeled as demo data.
              ownedFigurines: 1,
              figurineSkills: [
                { slotIndex: 0, skill1Learned: false, skill2Learned: false },
              ],
            },
            { id: "p2", displayName: "Player 2" },
            { id: "p3", displayName: "Player 3" },
            { id: "p4", displayName: "Player 4" },
          ],
        });
        setLoadState({ status: "ready", match });
        setUi({
          ...initialMatchUiState,
          statusMessage:
            "Demo: Player 1 has 1 sample figurine (skills not learned). Click it for the activation popup.",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown startup error";
        setLoadState({ status: "error", message });
      }
    }, 200);

    return () => window.clearTimeout(timer);
  }, []);

  const bridge = typeof window !== "undefined" ? window.desktopBridge : undefined;

  const onPick = (pick: PickPayload) => {
    if (loadState.status !== "ready") return;
    const match = loadState.match;
    const activeId = getActivePlayerId(match);

    if (pick.kind === "figurine-slot") {
      if (pick.ownerId !== activeId) {
        setUi((prev) => ({
          ...prev,
          statusMessage: "Figurine activation only for the active player (prototype).",
        }));
        return;
      }
      const gate = canOpenFigurinePopup(match, pick.ownerId, pick.slotIndex);
      if (!gate.ok) {
        setUi((prev) => ({ ...prev, statusMessage: gate.reason }));
        return;
      }
      setUi((prev) => ({
        ...prev,
        figurinePopup: { ownerId: pick.ownerId, slotIndex: pick.slotIndex },
        statusMessage: null,
      }));
      return;
    }

    setUi((prev) => ({
      ...prev,
      selectedCell: {
        ownerId: pick.ownerId,
        position: { column: pick.column, level: pick.level },
      },
      statusMessage: `Selected ${pick.ownerId} ${pick.column} L${pick.level}`,
    }));
  };

  const onEndTurn = () => {
    if (loadState.status !== "ready") return;
    const next = advanceTurn(loadState.match);
    setLoadState({ status: "ready", match: next });
    setUi((prev) => ({
      ...prev,
      statusMessage: `Turn → ${getActivePlayerId(next)} · level-turn L${next.levelTurn.activeLevel}`,
      figurinePopup: null,
    }));
  };

  const onBuild = () => {
    if (loadState.status !== "ready") return;
    const match = loadState.match;
    const activeId = getActivePlayerId(match);
    if (!ui.selectedCell) {
      setUi((prev) => ({
        ...prev,
        statusMessage: "Select a cell before Build.",
      }));
      return;
    }
    const result = applyBoardInteraction(match, {
      type: "build",
      actorId: activeId,
      targetOwnerId: ui.selectedCell.ownerId,
      position: ui.selectedCell.position,
      specialConditionOrCardSatisfied: false,
    });
    if (result.ok) {
      setLoadState({ status: "ready", match: result.state });
    }
    setUi((prev) => ({
      ...prev,
      statusMessage: result.ok ? result.note : result.reason,
    }));
  };

  const onDestroy = () => {
    if (loadState.status !== "ready") return;
    const match = loadState.match;
    const activeId = getActivePlayerId(match);
    if (!ui.selectedCell) {
      setUi((prev) => ({
        ...prev,
        statusMessage: "Select a cell before Destroy.",
      }));
      return;
    }
    const result = applyBoardInteraction(match, {
      type: "destroy",
      actorId: activeId,
      targetOwnerId: ui.selectedCell.ownerId,
      position: ui.selectedCell.position,
    });
    setUi((prev) => ({
      ...prev,
      statusMessage: result.ok ? result.note : result.reason,
    }));
  };

  const onActivateFigurineDemo = () => {
    if (loadState.status !== "ready") return;
    const match = loadState.match;
    const activeId = getActivePlayerId(match);
    const gate = canOpenFigurinePopup(match, activeId, 0);
    if (!gate.ok) {
      setUi((prev) => ({ ...prev, statusMessage: gate.reason }));
      return;
    }
    setUi((prev) => ({
      ...prev,
      figurinePopup: { ownerId: activeId, slotIndex: 0 },
      statusMessage: null,
    }));
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Four Player Board</h1>
          <p className="app-subtitle">Milestone 1 local prototype</p>
        </div>
      </header>

      <main className="app-main" aria-live="polite">
        {loadState.status === "loading" && (
          <section className="state-panel state-loading">
            <p>Loading table…</p>
          </section>
        )}

        {loadState.status === "empty" && (
          <section className="state-panel state-empty">
            <h2>Empty match state</h2>
            <p>{loadState.message}</p>
          </section>
        )}

        {loadState.status === "error" && (
          <section className="state-panel state-error" role="alert">
            <h2>Startup error</h2>
            <p>{loadState.message}</p>
          </section>
        )}

        {loadState.status === "ready" && (
          <div className="viewport-wrap">
            <MatchHud
              match={loadState.match}
              selectedCell={ui.selectedCell}
              statusMessage={ui.statusMessage}
              onEndTurn={onEndTurn}
              onBuild={onBuild}
              onDestroy={onDestroy}
              onActivateFigurineDemo={onActivateFigurineDemo}
            />
            <GameViewport
              match={loadState.match}
              selection={ui.selectedCell}
              onPick={onPick}
            />
            <aside className="side-notes">
              <p>
                End turn advances player and level together (P1/L1 → P2/L2 → …). Builds stay on the
                board after the turn changes.
              </p>
              <p>
                Opponent-board builds still need a special condition/card. Destroy and cash costs
                come in later milestones. Figurines: activate via popup — not moved.
              </p>
            </aside>
            {ui.figurinePopup && (
              <FigurineActivateModal
                match={loadState.match}
                popup={ui.figurinePopup}
                onClose={() =>
                  setUi((prev) => ({ ...prev, figurinePopup: null }))
                }
                onResult={(message) =>
                  setUi((prev) => ({
                    ...prev,
                    statusMessage: message,
                    figurinePopup: null,
                  }))
                }
              />
            )}
          </div>
        )}
      </main>

      <footer className="app-footer">
        <span>
          Desktop bridge:{" "}
          {bridge ? `${bridge.appPhase} (${bridge.platform})` : "browser-only / unavailable"}
        </span>
      </footer>
    </div>
  );
}

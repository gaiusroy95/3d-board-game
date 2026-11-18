import { useEffect, useState } from "react";
import { M2Assumptions } from "@domain/assumptions";
import { takeBuildBorrow } from "@domain/borrows";
import { applyBoardInteraction } from "@domain/buildDestroy";
import { canOpenFigurinePopup } from "@domain/figurineActivation";
import { tryUnlockNextFigurine } from "@domain/figurineUnlock";
import {
  createFourPlayerMatch,
  getActivePlayerId,
  type MatchState,
} from "@domain/match";
import { endTurnWithPayout } from "@domain/turnLifecycle";
import { evaluateMatchOutcomes } from "@domain/winLose";
import { CardPanel } from "./CardPanel";
import { FigurineActivateModal } from "./FigurineActivateModal";
import { GameViewport } from "./GameViewport";
import { LoanPanel } from "./LoanPanel";
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

export function App() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [ui, setUi] = useState<MatchUiState>(initialMatchUiState);
  const [outcomeBanner, setOutcomeBanner] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const match = createFourPlayerMatch({
          matchId: "local-prototype-1",
          players: [
            {
              id: "p1",
              displayName: "Player 1",
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
            "M2: Build pays cost → Bank. End turn pays Normal/Extra returns. Decks & loans in side panels.",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown startup error";
        setLoadState({ status: "error", message });
      }
    }, 200);

    return () => window.clearTimeout(timer);
  }, []);

  const bridge = typeof window !== "undefined" ? window.desktopBridge : undefined;

  const applyMatch = (match: MatchState, note: string) => {
    setLoadState({ status: "ready", match });
    setUi((prev) => ({ ...prev, statusMessage: note }));
    const outcomes = evaluateMatchOutcomes(match);
    const interesting = Object.entries(outcomes.byPlayer).filter(
      ([, o]) => o.status !== "playing",
    );
    if (outcomes.specialEndTriggered || interesting.length > 0) {
      setOutcomeBanner(outcomes.note);
    }
  };

  const onPick = (pick: PickPayload) => {
    if (loadState.status !== "ready") return;
    const match = loadState.match;
    const activeId = getActivePlayerId(match);

    if (pick.kind === "figurine-slot") {
      if (pick.ownerId !== activeId) {
        setUi((prev) => ({
          ...prev,
          statusMessage: "Figurine activation only for the active player.",
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
    const { state: next, payoutNote, outcomeNote } = endTurnWithPayout(
      loadState.match,
    );
    setLoadState({ status: "ready", match: next });
    setUi((prev) => ({
      ...prev,
      statusMessage: `${payoutNote} Turn → ${getActivePlayerId(next)} · L${next.levelTurn.activeLevel}`,
      figurinePopup: null,
    }));
    setOutcomeBanner(outcomeNote);
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
    const actor = match.players.find((p) => p.id === activeId);
    const result = applyBoardInteraction(match, {
      type: "build",
      actorId: activeId,
      targetOwnerId: ui.selectedCell.ownerId,
      position: ui.selectedCell.position,
      specialConditionOrCardSatisfied: actor?.canBuildOnOpponent ?? false,
    });
    if (result.ok) {
      applyMatch(result.state, result.note);
    } else {
      setUi((prev) => ({ ...prev, statusMessage: result.reason }));
    }
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

  const onUnlockFigurine = () => {
    if (loadState.status !== "ready") return;
    const result = tryUnlockNextFigurine(
      loadState.match,
      getActivePlayerId(loadState.match),
    );
    if (result.ok) applyMatch(result.state, result.note);
    else setUi((prev) => ({ ...prev, statusMessage: result.reason }));
  };

  const onBuildBorrow = () => {
    if (loadState.status !== "ready") return;
    if (!ui.selectedCell) {
      setUi((prev) => ({
        ...prev,
        statusMessage: "Select a cell before Build borrow.",
      }));
      return;
    }
    const result = takeBuildBorrow(
      loadState.match,
      getActivePlayerId(loadState.match),
      ui.selectedCell.position,
    );
    if (result.ok) applyMatch(result.state, result.note);
    else setUi((prev) => ({ ...prev, statusMessage: result.reason }));
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>{M2Assumptions.gameTitle}</h1>
          <p className="app-subtitle">Milestone 2 — core gameplay</p>
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
            {outcomeBanner && (
              <div className="outcome-banner" role="status">
                {outcomeBanner}
              </div>
            )}
            <MatchHud
              match={loadState.match}
              selectedCell={ui.selectedCell}
              statusMessage={ui.statusMessage}
              onEndTurn={onEndTurn}
              onBuild={onBuild}
              onDestroy={onDestroy}
              onActivateFigurineDemo={onActivateFigurineDemo}
              onUnlockFigurine={onUnlockFigurine}
              onBuildBorrow={onBuildBorrow}
            />
            <div className="play-layout">
              <GameViewport
                match={loadState.match}
                selection={ui.selectedCell}
                onPick={onPick}
              />
              <div className="side-stack">
                <CardPanel
                  match={loadState.match}
                  selectedCell={ui.selectedCell}
                  onMatchChange={applyMatch}
                />
                <LoanPanel match={loadState.match} onMatchChange={applyMatch} />
              </div>
            </div>
            <aside className="side-notes">
              <p>
                End turn: figurine having reward → Normal/Extra level returns → next
                player+level together. Builds persist and cost cash immediately.
              </p>
              <p>
                Opponent builds need a permit card (Deck1 first card) or condition flag.
                Card list, limit-scheme %, and loan “advantage” terms remain OPEN placeholders.
              </p>
            </aside>
            {ui.figurinePopup && (
              <FigurineActivateModal
                match={loadState.match}
                popup={ui.figurinePopup}
                onClose={() =>
                  setUi((prev) => ({ ...prev, figurinePopup: null }))
                }
                onMatchChange={(next, message) => {
                  applyMatch(next, message);
                  setUi((prev) => ({ ...prev, figurinePopup: null }));
                }}
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

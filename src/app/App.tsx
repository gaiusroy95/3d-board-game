import { useEffect, useState } from "react";
import { takeBuildBorrow } from "@domain/borrows";
import { applyBoardInteraction } from "@domain/buildDestroy";
import { canOpenFigurinePopup } from "@domain/figurineActivation";
import { tryUnlockNextFigurine } from "@domain/figurineUnlock";
import {
  createFourPlayerMatch,
  getActivePlayerId,
  type MatchState,
} from "@domain/match";
import { M3OnlineConfig } from "@domain/onlineConfig";
import {
  clearTurnTimer,
  createOnlineMeta,
  forceEndTurnIfTimedOut,
  startTurnTimer,
  turnTimeRemainingMs,
  type OnlineMatchMeta,
} from "@domain/onlineSession";
import { endTurnWithPayout } from "@domain/turnLifecycle";
import { evaluateMatchOutcomes } from "@domain/winLose";
import { evaluateAllObjectives } from "@domain/objectives";
import { DedicatedMatchServer } from "@interfaces/dedicatedServer";
import type { ReadyMatchRoom } from "@interfaces/matchmaking";
import { CardPanel } from "./CardPanel";
import { FigurineActivateModal } from "./FigurineActivateModal";
import { GameViewport } from "./GameViewport";
import { LoanPanel } from "./LoanPanel";
import { MatchHud } from "./MatchHud";
import { MatchmakingPanel } from "./MatchmakingPanel";
import { ObjectivesPanel } from "./ObjectivesPanel";
import {
  initialMatchUiState,
  type MatchUiState,
  type PickPayload,
} from "./matchUi";

type AppPhase =
  | { status: "lobby" }
  | {
      status: "playing";
      match: MatchState;
      mode: "local" | "online";
      localPlayerId: string | null;
      onlineMeta: OnlineMatchMeta | null;
      server: DedicatedMatchServer | null;
    }
  | { status: "error"; message: string };

export function App() {
  const [phase, setPhase] = useState<AppPhase>({ status: "lobby" });
  const [ui, setUi] = useState<MatchUiState>(initialMatchUiState);
  const [outcomeBanner, setOutcomeBanner] = useState<string | null>(null);
  const [turnSecondsLeft, setTurnSecondsLeft] = useState<number | null>(null);

  const bridge = typeof window !== "undefined" ? window.desktopBridge : undefined;

  const startLocalHotseat = () => {
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
      setPhase({
        status: "playing",
        match,
        mode: "local",
        localPlayerId: null,
        onlineMeta: null,
        server: null,
      });
      setUi({
        ...initialMatchUiState,
        statusMessage:
          "Local hotseat. Select a cell, Build, then End turn for Normal/Extra returns.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown startup error";
      setPhase({ status: "error", message });
    }
  };

  const startOnlineRoom = (room: ReadyMatchRoom, localPlayerId: string) => {
    const server = new DedicatedMatchServer(room.players);
    const meta = startTurnTimer(createOnlineMeta(localPlayerId, "player"));
    setPhase({
      status: "playing",
      match: server.getState(),
      mode: "online",
      localPlayerId,
      onlineMeta: meta,
      server,
    });
    setUi({
      ...initialMatchUiState,
      statusMessage: `Online room ${room.roomId}. Own-board view · 3 min turns · disconnect = KO.`,
    });
  };

  // Online turn timer tick
  useEffect(() => {
    if (phase.status !== "playing" || phase.mode !== "online" || !phase.onlineMeta) {
      setTurnSecondsLeft(null);
      return;
    }
    const tick = () => {
      if (phase.status !== "playing" || !phase.onlineMeta) return;
      const remaining = turnTimeRemainingMs(phase.onlineMeta);
      setTurnSecondsLeft(
        remaining == null ? null : Math.ceil(remaining / 1000),
      );
      if (remaining != null && remaining <= 0 && phase.server) {
        const forced = forceEndTurnIfTimedOut(
          phase.match,
          phase.onlineMeta,
        );
        if (forced.forced) {
          setPhase({
            ...phase,
            match: forced.state,
            onlineMeta: forced.meta,
          });
          setUi((prev) => ({ ...prev, statusMessage: forced.note }));
        }
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [phase]);

  const active =
    phase.status === "playing"
      ? phase.match.players.find((p) => p.id === getActivePlayerId(phase.match))
      : null;

  const applyMatch = (match: MatchState, note: string) => {
    if (phase.status !== "playing") return;
    const claimed = evaluateAllObjectives(match);
    const outcomes = evaluateMatchOutcomes(claimed.state);
    const next = outcomes.state;
    const fullNote =
      claimed.notes.length > 0 ? `${note} ${claimed.notes.join(" ")}` : note;
    setPhase({ ...phase, match: next });
    setUi((prev) => ({ ...prev, statusMessage: fullNote }));
    const interesting = Object.entries(outcomes.byPlayer).filter(
      ([, o]) => o.status !== "playing",
    );
    if (outcomes.specialEndTriggered || interesting.length > 0 || outcomes.pointsWinnerId) {
      setOutcomeBanner(outcomes.note);
    }
  };

  const onPick = (pick: PickPayload) => {
    if (phase.status !== "playing") return;
    const match = phase.match;
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

    // M3 own-board: only select cells on your board when online
    if (
      phase.mode === "online" &&
      phase.localPlayerId &&
      pick.ownerId !== phase.localPlayerId &&
      M3OnlineConfig.playerViewMode === "own-board"
    ) {
      setUi((prev) => ({
        ...prev,
        statusMessage: "Online play: you only interact with your own board.",
      }));
      return;
    }

    setUi((prev) => ({
      ...prev,
      selectedCell: {
        ownerId: pick.ownerId,
        position: { column: pick.column, level: pick.level },
      },
      statusMessage: `Selected ${pick.ownerId} · ${pick.column} · L${pick.level}`,
    }));
  };

  const onEndTurn = () => {
    if (phase.status !== "playing") return;
    if (phase.server) {
      const result = phase.server.dispatch({
        type: "end-turn",
        playerId: getActivePlayerId(phase.match),
      });
      if (!result.ok) {
        setUi((prev) => ({ ...prev, statusMessage: result.reason }));
        return;
      }
      setPhase({
        ...phase,
        match: result.state,
        onlineMeta: startTurnTimer(clearTurnTimer(result.meta)),
      });
      setUi((prev) => ({
        ...prev,
        statusMessage: result.note,
        figurinePopup: null,
      }));
      setOutcomeBanner(evaluateMatchOutcomes(result.state).note);
      return;
    }
    const { state: next, payoutNote, outcomeNote } = endTurnWithPayout(
      phase.match,
    );
    setPhase({ ...phase, match: next });
    setUi((prev) => ({
      ...prev,
      statusMessage: `${payoutNote} Next: ${getActivePlayerId(next)} · L${next.levelTurn.activeLevel}`,
      figurinePopup: null,
    }));
    setOutcomeBanner(outcomeNote);
  };

  const onBuild = () => {
    if (phase.status !== "playing") return;
    const match = phase.match;
    const activeId = getActivePlayerId(match);
    if (!ui.selectedCell) {
      setUi((prev) => ({
        ...prev,
        statusMessage: "Select a cell on the table before Build.",
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
    if (result.ok) applyMatch(result.state, result.note);
    else setUi((prev) => ({ ...prev, statusMessage: result.reason }));
  };

  const onDestroy = () => {
    if (phase.status !== "playing") return;
    const match = phase.match;
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
    if (phase.status !== "playing") return;
    const match = phase.match;
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
    if (phase.status !== "playing") return;
    const result = tryUnlockNextFigurine(
      phase.match,
      getActivePlayerId(phase.match),
    );
    if (result.ok) applyMatch(result.state, result.note);
    else setUi((prev) => ({ ...prev, statusMessage: result.reason }));
  };

  const onBuildBorrow = () => {
    if (phase.status !== "playing") return;
    if (!ui.selectedCell) {
      setUi((prev) => ({
        ...prev,
        statusMessage: "Select a cell before Build borrow.",
      }));
      return;
    }
    const result = takeBuildBorrow(
      phase.match,
      getActivePlayerId(phase.match),
      ui.selectedCell.position,
    );
    if (result.ok) applyMatch(result.state, result.note);
    else setUi((prev) => ({ ...prev, statusMessage: result.reason }));
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-block">
          <p className="brand-kicker">Four-player street legend</p>
          <h1>
            Back in <span className="brand-mark">century 20</span>
          </h1>
          <p className="app-subtitle">
            Four boards. One dark table. Build the street, work the bank, and outplay the
            others before the century turns.
          </p>
        </div>
        {phase.status === "playing" && (
          <div className="header-meta">
            <div className="turn-pill" aria-live="polite">
              <span>Level</span>
              <strong>L{phase.match.levelTurn.activeLevel}</strong>
              <span>· {active?.displayName ?? "—"}</span>
              {phase.mode === "online" && <span>· online</span>}
            </div>
            <div className="bank-chip">
              Bank vault <strong>{phase.match.bankBalance}</strong>
            </div>
          </div>
        )}
      </header>

      <main className="app-main" aria-live="polite">
        {phase.status === "lobby" && (
          <div className="lobby-layout">
            <MatchmakingPanel onMatchReady={startOnlineRoom} />
            <section className="state-panel">
              <h2>Or play locally</h2>
              <p className="muted tiny">
                Hotseat on one machine (Milestone 2 table) — all boards visible.
              </p>
              <button
                type="button"
                className="hud-button primary"
                onClick={startLocalHotseat}
              >
                Local table
              </button>
            </section>
          </div>
        )}

        {phase.status === "error" && (
          <section className="state-panel state-error" role="alert">
            <h2>Startup error</h2>
            <p>{phase.message}</p>
          </section>
        )}

        {phase.status === "playing" && (
          <div className="viewport-wrap">
            {outcomeBanner && (
              <div className="outcome-banner" role="status">
                {outcomeBanner}
              </div>
            )}
            <div className="play-layout">
              <div className="stage-column">
                <MatchHud
                  match={phase.match}
                  selectedCell={ui.selectedCell}
                  statusMessage={ui.statusMessage}
                  onEndTurn={onEndTurn}
                  onBuild={onBuild}
                  onDestroy={onDestroy}
                  onActivateFigurineDemo={onActivateFigurineDemo}
                  onUnlockFigurine={onUnlockFigurine}
                  onBuildBorrow={onBuildBorrow}
                  turnSecondsLeft={turnSecondsLeft}
                  localPlayerId={phase.localPlayerId}
                />
                <div className="stage-frame">
                  <GameViewport
                    match={phase.match}
                    selection={ui.selectedCell}
                    onPick={onPick}
                    focusPlayerId={
                      phase.mode === "online" ? phase.localPlayerId : null
                    }
                    ownBoardOnly={
                      phase.mode === "online" &&
                      M3OnlineConfig.playerViewMode === "own-board"
                    }
                  />
                  <div className="stage-caption">
                    <strong>
                      {phase.mode === "online" ? "Your board" : "The table"}
                    </strong>
                    {phase.mode === "online"
                      ? " Own-board view. 3-minute turns. Disconnect = knockout."
                      : " Click a cell to select. Build costs cash into the Bank. End turn pays returns."}
                  </div>
                </div>
              </div>
              <aside className="side-stack" aria-label="Street ledger">
                <p className="ledger-title">Street ledger</p>
                <p className="ledger-sub">Cards · loans · objectives</p>
                <CardPanel
                  match={phase.match}
                  selectedCell={ui.selectedCell}
                  onMatchChange={applyMatch}
                />
                <LoanPanel match={phase.match} onMatchChange={applyMatch} />
                <ObjectivesPanel
                  match={phase.match}
                  onMatchChange={applyMatch}
                />
              </aside>
            </div>
            {ui.figurinePopup && (
              <FigurineActivateModal
                match={phase.match}
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
          {phase.status === "playing" && phase.mode === "online"
            ? "M3 online stub · dedicated authority · Steam pending"
            : "Local / lobby"}{" "}
          ·{" "}
          {bridge ? `Desktop ${bridge.appPhase} (${bridge.platform})` : "browser preview"}
        </span>
      </footer>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
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
import { evaluateAllObjectives } from "@domain/objectives";
import { endTurnWithPayout } from "@domain/turnLifecycle";
import { evaluateMatchOutcomes } from "@domain/winLose";
import {
  DedicatedMatchServer,
  type ServerAction,
} from "@interfaces/dedicatedServer";
import type { RoomClient } from "@net/roomClient";
import { CardPanel } from "./CardPanel";
import { FigurineActivateModal } from "./FigurineActivateModal";
import { GameViewport } from "./GameViewport";
import { LoanPanel } from "./LoanPanel";
import { MatchHud } from "./MatchHud";
import { MatchmakingPanel } from "./MatchmakingPanel";
import { ObjectivesPanel } from "./ObjectivesPanel";
import { RoomLobbyPanel, type RoomStartPayload } from "./RoomLobbyPanel";
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
      mode: "local" | "online" | "room";
      localPlayerId: string | null;
      onlineMeta: OnlineMatchMeta | null;
      server: DedicatedMatchServer | null;
      roomClient: RoomClient | null;
      isHost: boolean;
      roomCode: string | null;
    }
  | { status: "error"; message: string };

function commitMatch(
  match: MatchState,
  note: string,
): { match: MatchState; note: string; banner: string | null } {
  const claimed = evaluateAllObjectives(match);
  const outcomes = evaluateMatchOutcomes(claimed.state);
  const fullNote =
    claimed.notes.length > 0 ? `${note} ${claimed.notes.join(" ")}` : note;
  const interesting = Object.entries(outcomes.byPlayer).filter(
    ([, o]) => o.status !== "playing",
  );
  const banner =
    outcomes.specialEndTriggered ||
    interesting.length > 0 ||
    outcomes.pointsWinnerId
      ? outcomes.note
      : null;
  return { match: outcomes.state, note: fullNote, banner };
}

export function App() {
  const [phase, setPhase] = useState<AppPhase>({ status: "lobby" });
  const [ui, setUi] = useState<MatchUiState>(initialMatchUiState);
  const [outcomeBanner, setOutcomeBanner] = useState<string | null>(null);
  const [turnSecondsLeft, setTurnSecondsLeft] = useState<number | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const bridge = typeof window !== "undefined" ? window.desktopBridge : undefined;

  const broadcastIfHost = (
    match: MatchState,
    note: string,
    meta: OnlineMatchMeta | null,
    client: RoomClient | null,
    isHost: boolean,
  ) => {
    if (isHost && client) {
      client.send({ type: "state", state: match, note, meta });
    }
  };

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
        roomClient: null,
        isHost: true,
        roomCode: null,
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

  const startBotDemo = (
    room: { roomId: string; players: readonly { id: string; displayName: string; ready: boolean; steamId: string | null }[] },
    localPlayerId: string,
  ) => {
    const server = new DedicatedMatchServer(room.players);
    setPhase({
      status: "playing",
      match: server.getState(),
      mode: "online",
      localPlayerId,
      onlineMeta: startTurnTimer(createOnlineMeta(localPlayerId, "player")),
      server,
      roomClient: null,
      isHost: true,
      roomCode: room.roomId,
    });
    setUi({
      ...initialMatchUiState,
      statusMessage: `Solo bot demo ${room.roomId}. Own-board · 3 min turns.`,
    });
  };

  const startNetworkedRoom = (payload: RoomStartPayload) => {
    const matchPlayers = payload.players.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      ready: p.ready,
      steamId: null as string | null,
    }));

    let server: DedicatedMatchServer | null = null;
    let match: MatchState;
    let meta: OnlineMatchMeta;

    if (payload.isHost) {
      server = new DedicatedMatchServer(matchPlayers);
      match = server.getState();
      meta = startTurnTimer(createOnlineMeta(payload.localPlayerId, "player"));
      payload.client.send({
        type: "state",
        state: match,
        note: `Room ${payload.roomCode} started. Host authority.`,
        meta,
      });
    } else {
      match = createFourPlayerMatch({
        matchId: `room-${payload.roomCode}`,
        players: matchPlayers.map((p) => ({
          id: p.id,
          displayName: p.displayName,
          ownedFigurines: 1,
          figurineSkills: [
            { slotIndex: 0, skill1Learned: false, skill2Learned: false },
          ],
        })),
      });
      meta = startTurnTimer(createOnlineMeta(payload.localPlayerId, "player"));
    }

    payload.client.handlers.onState = (msg) => {
      const current = phaseRef.current;
      if (current.status !== "playing" || current.mode !== "room") return;
      if (current.isHost) return;
      setPhase({
        ...current,
        match: msg.state,
        onlineMeta: msg.meta ?? current.onlineMeta,
      });
      setUi((prev) => ({
        ...prev,
        statusMessage: msg.note || prev.statusMessage,
      }));
      const outcomes = evaluateMatchOutcomes(msg.state);
      if (outcomes.pointsWinnerId || outcomes.specialEndTriggered) {
        setOutcomeBanner(outcomes.note);
      }
    };

    payload.client.handlers.onActionFrom = (fromPlayerId, action) => {
      const current = phaseRef.current;
      if (current.status !== "playing" || !current.isHost || !current.server) {
        return;
      }
      const result = current.server.dispatch(action as ServerAction);
      if (!result.ok) return;
      const committed = commitMatch(result.state, result.note);
      const nextMeta = startTurnTimer(clearTurnTimer(result.meta));
      setPhase({
        ...current,
        match: committed.match,
        onlineMeta: nextMeta,
      });
      setUi((prev) => ({ ...prev, statusMessage: committed.note }));
      if (committed.banner) setOutcomeBanner(committed.banner);
      broadcastIfHost(
        committed.match,
        committed.note,
        nextMeta,
        current.roomClient,
        true,
      );
    };

    payload.client.handlers.onDisconnectPlayer = (playerId) => {
      const current = phaseRef.current;
      if (current.status !== "playing" || !current.isHost || !current.server) {
        return;
      }
      const result = current.server.dispatch({
        type: "disconnect",
        playerId,
      });
      const note = result.ok ? result.note : result.reason;
      const committed = commitMatch(result.state, note);
      setPhase({ ...current, match: committed.match });
      setUi((prev) => ({ ...prev, statusMessage: committed.note }));
      if (committed.banner) setOutcomeBanner(committed.banner);
      broadcastIfHost(
        committed.match,
        committed.note,
        current.onlineMeta,
        current.roomClient,
        true,
      );
    };

    setPhase({
      status: "playing",
      match,
      mode: "room",
      localPlayerId: payload.localPlayerId,
      onlineMeta: meta,
      server,
      roomClient: payload.client,
      isHost: payload.isHost,
      roomCode: payload.roomCode,
    });
    setUi({
      ...initialMatchUiState,
      statusMessage: payload.isHost
        ? `Room ${payload.roomCode} — you are host. Waiting for synced play.`
        : `Room ${payload.roomCode} — joined. Waiting for host state…`,
    });
  };

  useEffect(() => {
    if (
      phase.status !== "playing" ||
      (phase.mode !== "online" && phase.mode !== "room") ||
      !phase.onlineMeta
    ) {
      setTurnSecondsLeft(null);
      return;
    }
    const tick = () => {
      const current = phaseRef.current;
      if (current.status !== "playing" || !current.onlineMeta) return;
      const remaining = turnTimeRemainingMs(current.onlineMeta);
      setTurnSecondsLeft(
        remaining == null ? null : Math.ceil(remaining / 1000),
      );
      if (
        remaining != null &&
        remaining <= 0 &&
        current.isHost &&
        current.server
      ) {
        const forced = forceEndTurnIfTimedOut(
          current.match,
          current.onlineMeta,
        );
        if (forced.forced) {
          const committed = commitMatch(forced.state, forced.note);
          setPhase({
            ...current,
            match: committed.match,
            onlineMeta: forced.meta,
          });
          setUi((prev) => ({ ...prev, statusMessage: committed.note }));
          broadcastIfHost(
            committed.match,
            committed.note,
            forced.meta,
            current.roomClient,
            true,
          );
        }
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [phase.status, phase.status === "playing" ? phase.mode : null]);

  const active =
    phase.status === "playing"
      ? phase.match.players.find((p) => p.id === getActivePlayerId(phase.match))
      : null;

  const applyMatch = (match: MatchState, note: string) => {
    if (phase.status !== "playing") return;
    if (phase.mode === "room" && !phase.isHost) {
      setUi((prev) => ({
        ...prev,
        statusMessage: "Only the host applies ledger actions in test rooms — use Build / End turn on your turn (synced).",
      }));
      return;
    }
    const committed = commitMatch(match, note);
    setPhase({ ...phase, match: committed.match });
    setUi((prev) => ({ ...prev, statusMessage: committed.note }));
    if (committed.banner) setOutcomeBanner(committed.banner);
    broadcastIfHost(
      committed.match,
      committed.note,
      phase.onlineMeta,
      phase.roomClient,
      phase.isHost,
    );
  };

  const runHostAction = (action: ServerAction) => {
    if (phase.status !== "playing" || !phase.server) return;
    const result = phase.server.dispatch(action);
    if (!result.ok) {
      setUi((prev) => ({ ...prev, statusMessage: result.reason }));
      return;
    }
    const committed = commitMatch(result.state, result.note);
    const nextMeta =
      action.type === "end-turn"
        ? startTurnTimer(clearTurnTimer(result.meta))
        : result.meta;
    setPhase({
      ...phase,
      match: committed.match,
      onlineMeta: nextMeta,
    });
    setUi((prev) => ({
      ...prev,
      statusMessage: committed.note,
      figurinePopup: action.type === "end-turn" ? null : prev.figurinePopup,
    }));
    if (committed.banner) setOutcomeBanner(committed.banner);
    broadcastIfHost(
      committed.match,
      committed.note,
      nextMeta,
      phase.roomClient,
      phase.isHost,
    );
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

    if (
      (phase.mode === "online" || phase.mode === "room") &&
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
    const activeId = getActivePlayerId(phase.match);

    if (phase.mode === "room" && phase.roomClient) {
      if (phase.localPlayerId !== activeId) {
        setUi((prev) => ({ ...prev, statusMessage: "Not your turn." }));
        return;
      }
      const action: ServerAction = { type: "end-turn", playerId: activeId };
      if (phase.isHost) runHostAction(action);
      else phase.roomClient.send({ type: "action", action });
      return;
    }

    if (phase.server) {
      runHostAction({ type: "end-turn", playerId: activeId });
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
    if (
      (phase.mode === "online" || phase.mode === "room") &&
      phase.localPlayerId &&
      phase.localPlayerId !== activeId
    ) {
      setUi((prev) => ({ ...prev, statusMessage: "Not your turn." }));
      return;
    }

    const actor = match.players.find((p) => p.id === activeId);
    const request = {
      type: "build" as const,
      actorId: activeId,
      targetOwnerId: ui.selectedCell.ownerId,
      position: ui.selectedCell.position,
      specialConditionOrCardSatisfied: actor?.canBuildOnOpponent ?? false,
    };

    if (phase.mode === "room" && phase.roomClient) {
      const action: ServerAction = {
        type: "build-interaction",
        playerId: activeId,
        request,
      };
      if (phase.isHost) runHostAction(action);
      else phase.roomClient.send({ type: "action", action });
      return;
    }

    const result = applyBoardInteraction(match, request);
    if (result.ok) applyMatch(result.state, result.note);
    else setUi((prev) => ({ ...prev, statusMessage: result.reason }));
  };

  const onDestroy = () => {
    setUi((prev) => ({ ...prev, statusMessage: "Destroy is disabled." }));
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

  const networked = phase.status === "playing" && phase.mode !== "local";

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
              {phase.mode === "room" && phase.roomCode && (
                <span>· room {phase.roomCode}</span>
              )}
              {phase.mode === "online" && <span>· bot demo</span>}
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
            <RoomLobbyPanel onMatchStart={startNetworkedRoom} />
            <MatchmakingPanel onMatchReady={startBotDemo} />
            <section className="state-panel">
              <h2>Or play locally</h2>
              <p className="muted tiny">
                Hotseat on one machine — all boards visible.
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
                      networked ? phase.localPlayerId : null
                    }
                    ownBoardOnly={
                      networked &&
                      M3OnlineConfig.playerViewMode === "own-board"
                    }
                  />
                  <div className="stage-caption">
                    <strong>
                      {networked ? "Your board" : "The table"}
                    </strong>
                    {networked
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
          {phase.status === "playing" && phase.mode === "room"
            ? `Lobby ${phase.roomCode}${phase.isHost ? " · host" : ""} · public · no Steam`
            : phase.status === "playing" && phase.mode === "online"
              ? "Solo bot demo · Steam pending"
              : "Local / lobby"}{" "}
          ·{" "}
          {bridge ? `Desktop ${bridge.appPhase} (${bridge.platform})` : "browser preview"}
        </span>
      </footer>
    </div>
  );
}

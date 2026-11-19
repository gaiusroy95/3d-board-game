import { M3OnlineConfig } from "@domain/onlineConfig";
import { RoomClient } from "@net/roomClient";
import {
  defaultRoomServerUrl,
  type LobbySummary,
  type RoomPlayerInfo,
} from "@net/roomProtocol";
import { useEffect, useRef, useState } from "react";

export interface RoomStartPayload {
  roomCode: string;
  hostId: string;
  localPlayerId: string;
  players: readonly RoomPlayerInfo[];
  client: RoomClient;
  isHost: boolean;
}

interface RoomLobbyPanelProps {
  onMatchStart: (payload: RoomStartPayload) => void;
}

export function RoomLobbyPanel({ onMatchStart }: RoomLobbyPanelProps) {
  const [name, setName] = useState("Player");
  const [lobbyName, setLobbyName] = useState("");
  const [serverUrl] = useState(defaultRoomServerUrl);
  const [status, setStatus] = useState("Connecting to public lobbies…");
  const [connected, setConnected] = useState(false);
  const [lobbies, setLobbies] = useState<readonly LobbySummary[]>([]);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [activeLobbyName, setActiveLobbyName] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [players, setPlayers] = useState<readonly RoomPlayerInfo[]>([]);
  const [ready, setReady] = useState(false);
  const clientRef = useRef<RoomClient | null>(null);
  const startedRef = useRef(false);
  const playerIdRef = useRef<string | null>(null);
  const onStartRef = useRef(onMatchStart);
  onStartRef.current = onMatchStart;
  playerIdRef.current = playerId;

  useEffect(() => {
    const client = new RoomClient(
      {
        onConnection: (s) => {
          setConnected(s === "open");
          if (s === "open") setStatus("Connected — open lobbies update live.");
          if (s === "connecting") setStatus(`Connecting to ${serverUrl}…`);
          if (s === "closed") {
            setConnected(false);
            setStatus("Disconnected from lobby server.");
          }
        },
        onError: (reason) => setStatus(reason),
        onLobbies: (list) => setLobbies(list),
        onJoined: (info) => {
          setRoomCode(info.roomCode);
          setActiveLobbyName(info.lobbyName);
          setPlayerId(info.playerId);
          playerIdRef.current = info.playerId;
          setHostId(info.hostId);
          setPlayers(info.players);
          setReady(false);
          setStatus(`In lobby “${info.lobbyName}” — waiting for ${M3OnlineConfig.playersPerMatch} players.`);
        },
        onLeft: () => {
          setRoomCode(null);
          setActiveLobbyName(null);
          setPlayerId(null);
          playerIdRef.current = null;
          setHostId(null);
          setPlayers([]);
          setReady(false);
          startedRef.current = false;
          setStatus("Left lobby — pick another or create one.");
        },
        onRoster: (list, host) => {
          setPlayers(list);
          setHostId(host);
          const me = list.find((p) => p.id === playerIdRef.current);
          if (me) setReady(me.ready);
        },
        onStart: (info) => {
          if (startedRef.current || !clientRef.current) return;
          startedRef.current = true;
          const localId = playerIdRef.current;
          if (!localId) return;
          onStartRef.current({
            roomCode: info.roomCode,
            hostId: info.hostId,
            localPlayerId: localId,
            players: info.players,
            client: clientRef.current,
            isHost: info.hostId === localId,
          });
        },
      },
      serverUrl,
    );
    client.connect();
    clientRef.current = client;
    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, [serverUrl]);

  const createLobby = () => {
    startedRef.current = false;
    const displayName = name.trim() || "Player";
    clientRef.current?.send({
      type: "create",
      displayName,
      lobbyName: lobbyName.trim() || `${displayName}'s lobby`,
    });
  };

  const joinLobby = (id: string) => {
    startedRef.current = false;
    clientRef.current?.send({
      type: "join",
      roomCode: id,
      displayName: name.trim() || "Player",
    });
  };

  const leaveLobby = () => {
    clientRef.current?.send({ type: "leave" });
  };

  const toggleReady = () => {
    const next = !ready;
    setReady(next);
    clientRef.current?.send({ type: "ready", ready: next });
  };

  const refresh = () => {
    clientRef.current?.send({ type: "list_lobbies" });
  };

  return (
    <section className="state-panel matchmaking-panel" aria-label="Public lobbies">
      <h2>Public lobbies (no Steam)</h2>
      <p>
        Open the site from anywhere, create a lobby or join an open one. Match starts when{" "}
        {M3OnlineConfig.playersPerMatch} players are ready — no host IP or access code.
      </p>
      <p className="muted tiny">{status}</p>

      <div className="hand-actions" style={{ marginBottom: "0.5rem" }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Display name"
          className="amount-input"
          disabled={roomCode != null}
          placeholder="Your name"
        />
      </div>

      {!roomCode ? (
        <>
          <div className="hand-actions" style={{ flexWrap: "wrap", marginBottom: "0.75rem" }}>
            <input
              value={lobbyName}
              onChange={(e) => setLobbyName(e.target.value)}
              aria-label="Lobby name"
              className="amount-input"
              placeholder="Lobby name (optional)"
              disabled={!connected}
            />
            <button
              type="button"
              className="hud-button primary"
              onClick={createLobby}
              disabled={!connected}
            >
              Create lobby
            </button>
            <button
              type="button"
              className="hud-button ghost"
              onClick={refresh}
              disabled={!connected}
            >
              Refresh
            </button>
          </div>

          <h3 className="muted tiny" style={{ margin: "0 0 0.35rem" }}>
            Open lobbies
          </h3>
          {lobbies.length === 0 ? (
            <p className="muted tiny">No open lobbies yet — create one for others to join.</p>
          ) : (
            <ul className="loan-list">
              {lobbies.map((lobby) => (
                <li key={lobby.id}>
                  <span>
                    {lobby.name}
                    <span className="muted tiny">
                      {" "}
                      · {lobby.seats}/{lobby.maxSeats} · host {lobby.hostName}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="hud-button accent compact"
                    onClick={() => joinLobby(lobby.id)}
                    disabled={!connected || lobby.seats >= lobby.maxSeats}
                  >
                    Join
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <p>
            Lobby: <strong>{activeLobbyName ?? roomCode}</strong>
            {hostId === playerId ? " (you are host)" : ""}
          </p>
          <ul className="loan-list">
            {players.map((p) => (
              <li key={p.id}>
                <span>
                  {p.displayName}
                  {p.id === playerId ? " (you)" : ""}
                  {p.id === hostId ? " · host" : ""}
                </span>
                <span className="muted tiny">{p.ready ? "Ready" : "Waiting"}</span>
              </li>
            ))}
          </ul>
          <p className="muted tiny">
            {players.length}/4 seated · {players.filter((p) => p.ready).length}/4 ready
          </p>
          <div className="hand-actions">
            <button type="button" className="hud-button accent" onClick={toggleReady}>
              {ready ? "Unready" : "Ready"}
            </button>
            <button type="button" className="hud-button ghost" onClick={leaveLobby}>
              Leave lobby
            </button>
          </div>
        </>
      )}

      <p className="muted tiny" style={{ marginTop: "0.75rem" }}>
        Works with the Vercel site once the lobby server is online (
        <code>VITE_ROOM_SERVER_URL</code>). Steam App ID still required later for Steam
        matchmaking.
      </p>
    </section>
  );
}

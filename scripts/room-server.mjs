/**
 * Public lobby + match room server (no Steam).
 * Browse open lobbies, create/join without sharing a host IP or code entry.
 * Host-authoritative match relay after all 4 ready.
 *
 * Usage: npm run room-server
 * Env: ROOM_PORT (default 4000)
 */
import { WebSocketServer } from "ws";
import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? process.env.ROOM_PORT ?? 4000);
const MAX_SEATS = 4;

/** @typedef {{ id: string, displayName: string, ready: boolean }} Player */
/** @typedef {{ code: string, name: string, hostId: string, players: Map<string, Player>, sockets: Map<string, import('ws').WebSocket>, started: boolean, createdAt: number }} Room */

/** @type {Map<string, Room>} */
const rooms = new Map();
/** @type {Set<import('ws').WebSocket>} */
const lobbyWatchers = new Set();

function code() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function roster(room) {
  return [...room.players.values()];
}

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function broadcast(room, msg, exceptId = null) {
  for (const [id, sock] of room.sockets) {
    if (exceptId && id === exceptId) continue;
    send(sock, msg);
  }
}

function makePlayerId() {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function lobbySummary(room) {
  const players = roster(room);
  const host = room.players.get(room.hostId);
  return {
    id: room.code,
    name: room.name,
    seats: players.length,
    maxSeats: MAX_SEATS,
    readyCount: players.filter((p) => p.ready).length,
    hostName: host?.displayName ?? "Host",
    started: room.started,
  };
}

function openLobbies() {
  return [...rooms.values()]
    .filter((r) => !r.started && r.players.size < MAX_SEATS)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(lobbySummary);
}

function publishLobbies() {
  const lobbies = openLobbies();
  const msg = { type: "lobbies", lobbies };
  for (const ws of lobbyWatchers) send(ws, msg);
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

const httpServer = createServer((req, res) => {
  cors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/api/lobbies" || url.pathname === "/lobbies") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ lobbies: openLobbies() }));
    return;
  }

  if (url.pathname === "/health" || url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        service: "board-game-lobbies",
        openLobbies: openLobbies().length,
        rooms: rooms.size,
      }),
    );
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws) => {
  /** @type {{ roomCode: string | null, playerId: string | null }} */
  const session = { roomCode: null, playerId: null };
  lobbyWatchers.add(ws);
  send(ws, { type: "lobbies", lobbies: openLobbies() });

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      send(ws, { type: "error", reason: "Invalid JSON." });
      return;
    }

    if (msg.type === "list_lobbies") {
      send(ws, { type: "lobbies", lobbies: openLobbies() });
      return;
    }

    if (msg.type === "create") {
      if (session.roomCode) {
        send(ws, { type: "error", reason: "Already in a lobby. Leave first." });
        return;
      }
      const displayName = String(msg.displayName || "Player").slice(0, 24);
      const lobbyName = String(msg.lobbyName || `${displayName}'s lobby`).slice(0, 40);
      let roomCode = code();
      while (rooms.has(roomCode)) roomCode = code();
      const playerId = makePlayerId();
      /** @type {Room} */
      const room = {
        code: roomCode,
        name: lobbyName,
        hostId: playerId,
        players: new Map(),
        sockets: new Map(),
        started: false,
        createdAt: Date.now(),
      };
      room.players.set(playerId, {
        id: playerId,
        displayName,
        ready: false,
      });
      room.sockets.set(playerId, ws);
      rooms.set(roomCode, room);
      lobbyWatchers.delete(ws);
      session.roomCode = roomCode;
      session.playerId = playerId;
      send(ws, {
        type: "joined",
        roomCode,
        lobbyName: room.name,
        playerId,
        hostId: playerId,
        players: roster(room),
      });
      publishLobbies();
      return;
    }

    if (msg.type === "join") {
      if (session.roomCode) {
        send(ws, { type: "error", reason: "Already in a lobby. Leave first." });
        return;
      }
      const roomCode = String(msg.roomCode || "")
        .trim()
        .toUpperCase();
      const room = rooms.get(roomCode);
      if (!room) {
        send(ws, { type: "error", reason: `Lobby not found.` });
        publishLobbies();
        return;
      }
      if (room.started) {
        send(ws, { type: "error", reason: "Match already started." });
        return;
      }
      if (room.players.size >= MAX_SEATS) {
        send(ws, { type: "error", reason: "Lobby is full (4/4)." });
        publishLobbies();
        return;
      }
      const displayName = String(msg.displayName || "Player").slice(0, 24);
      const playerId = makePlayerId();
      room.players.set(playerId, {
        id: playerId,
        displayName,
        ready: false,
      });
      room.sockets.set(playerId, ws);
      lobbyWatchers.delete(ws);
      session.roomCode = roomCode;
      session.playerId = playerId;
      send(ws, {
        type: "joined",
        roomCode,
        lobbyName: room.name,
        playerId,
        hostId: room.hostId,
        players: roster(room),
      });
      broadcast(room, {
        type: "roster",
        players: roster(room),
        hostId: room.hostId,
      });
      publishLobbies();
      return;
    }

    if (msg.type === "leave") {
      if (!session.roomCode) return;
      const roomCode = session.roomCode;
      const playerId = session.playerId;
      const room = rooms.get(roomCode);
      if (room && playerId) {
        room.players.delete(playerId);
        room.sockets.delete(playerId);
        if (room.players.size === 0) {
          rooms.delete(room.code);
        } else {
          if (playerId === room.hostId) {
            room.hostId = room.players.keys().next().value;
          }
          if (!room.started) {
            for (const p of room.players.values()) p.ready = false;
            broadcast(room, {
              type: "roster",
              players: roster(room),
              hostId: room.hostId,
            });
          } else {
            broadcast(room, {
              type: "disconnect",
              playerId,
              hostId: room.hostId,
            });
          }
        }
      }
      session.roomCode = null;
      session.playerId = null;
      lobbyWatchers.add(ws);
      send(ws, { type: "left" });
      send(ws, { type: "lobbies", lobbies: openLobbies() });
      publishLobbies();
      return;
    }

    if (msg.type === "ready") {
      const room = session.roomCode ? rooms.get(session.roomCode) : null;
      if (!room || !session.playerId) {
        send(ws, { type: "error", reason: "Not in a lobby." });
        return;
      }
      const player = room.players.get(session.playerId);
      if (!player) return;
      player.ready = Boolean(msg.ready);
      broadcast(room, {
        type: "roster",
        players: roster(room),
        hostId: room.hostId,
      });

      const readyCount = roster(room).filter((p) => p.ready).length;
      if (!room.started && room.players.size === MAX_SEATS && readyCount === MAX_SEATS) {
        room.started = true;
        broadcast(room, {
          type: "start",
          roomCode: room.code,
          lobbyName: room.name,
          hostId: room.hostId,
          players: roster(room),
        });
      }
      publishLobbies();
      return;
    }

    if (msg.type === "action") {
      const room = session.roomCode ? rooms.get(session.roomCode) : null;
      if (!room || !session.playerId) return;
      const hostWs = room.sockets.get(room.hostId);
      if (hostWs) {
        send(hostWs, {
          type: "action_from",
          fromPlayerId: session.playerId,
          action: msg.action,
        });
      }
      return;
    }

    if (msg.type === "state") {
      const room = session.roomCode ? rooms.get(session.roomCode) : null;
      if (!room || session.playerId !== room.hostId) {
        send(ws, { type: "error", reason: "Only host can broadcast state." });
        return;
      }
      broadcast(
        room,
        {
          type: "state",
          state: msg.state,
          note: msg.note ?? "",
          meta: msg.meta ?? null,
        },
        room.hostId,
      );
      return;
    }

    if (msg.type === "chat") {
      const room = session.roomCode ? rooms.get(session.roomCode) : null;
      if (!room || !session.playerId) return;
      const player = room.players.get(session.playerId);
      broadcast(room, {
        type: "chat",
        from: player?.displayName ?? session.playerId,
        text: String(msg.text || "").slice(0, 200),
      });
      return;
    }

    send(ws, { type: "error", reason: `Unknown type: ${msg.type}` });
  });

  ws.on("close", () => {
    lobbyWatchers.delete(ws);
    if (!session.roomCode || !session.playerId) return;
    const room = rooms.get(session.roomCode);
    if (!room) return;
    const leftId = session.playerId;
    room.players.delete(leftId);
    room.sockets.delete(leftId);

    if (room.players.size === 0) {
      rooms.delete(room.code);
      publishLobbies();
      return;
    }

    if (leftId === room.hostId) {
      room.hostId = room.players.keys().next().value;
    }

    if (room.started) {
      broadcast(room, {
        type: "disconnect",
        playerId: leftId,
        hostId: room.hostId,
      });
    } else {
      for (const p of room.players.values()) p.ready = false;
      broadcast(room, {
        type: "roster",
        players: roster(room),
        hostId: room.hostId,
      });
    }
    publishLobbies();
  });
});

// Keepalive so free hosts (e.g. Render) see traffic on long-lived sockets.
const heartbeat = setInterval(() => {
  for (const client of wss.clients) {
    if (client.readyState === 1) client.ping();
  }
}, 25_000);
wss.on("close", () => clearInterval(heartbeat));

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Lobby server listening on port ${PORT}`);
  console.log(`HTTP lobbies: http://127.0.0.1:${PORT}/api/lobbies`);
  console.log(`WebSocket:   ws://127.0.0.1:${PORT}`);
});


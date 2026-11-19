import type { MatchState } from "@domain/match";
import type { OnlineMatchMeta } from "@domain/onlineSession";
import type { ServerAction } from "@interfaces/dedicatedServer";

export interface RoomPlayerInfo {
  readonly id: string;
  readonly displayName: string;
  readonly ready: boolean;
}

export interface LobbySummary {
  readonly id: string;
  readonly name: string;
  readonly seats: number;
  readonly maxSeats: number;
  readonly readyCount: number;
  readonly hostName: string;
  readonly started: boolean;
}

export type ClientToServer =
  | { type: "list_lobbies" }
  | { type: "create"; displayName: string; lobbyName?: string }
  | { type: "join"; roomCode: string; displayName: string }
  | { type: "leave" }
  | { type: "ready"; ready: boolean }
  | { type: "action"; action: ServerAction }
  | {
      type: "state";
      state: MatchState;
      note?: string;
      meta?: OnlineMatchMeta | null;
    }
  | { type: "chat"; text: string };

export type ServerToClient =
  | { type: "lobbies"; lobbies: readonly LobbySummary[] }
  | {
      type: "joined";
      roomCode: string;
      lobbyName: string;
      playerId: string;
      hostId: string;
      players: readonly RoomPlayerInfo[];
    }
  | { type: "left" }
  | {
      type: "roster";
      players: readonly RoomPlayerInfo[];
      hostId: string;
    }
  | {
      type: "start";
      roomCode: string;
      lobbyName?: string;
      hostId: string;
      players: readonly RoomPlayerInfo[];
    }
  | {
      type: "action_from";
      fromPlayerId: string;
      action: ServerAction;
    }
  | {
      type: "state";
      state: MatchState;
      note: string;
      meta: OnlineMatchMeta | null;
    }
  | { type: "disconnect"; playerId: string; hostId: string }
  | { type: "chat"; from: string; text: string }
  | { type: "error"; reason: string };

/** Public lobby WebSocket URL baked in at build time (Vercel / production). */
export function configuredRoomServerUrl(): string | undefined {
  const raw = import.meta.env.VITE_ROOM_SERVER_URL as string | undefined;
  if (raw && raw.trim()) return raw.trim();
  return undefined;
}

export function defaultRoomServerUrl(): string {
  if (typeof window === "undefined") {
    return configuredRoomServerUrl() ?? "ws://127.0.0.1:4000";
  }
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("ws");
  if (fromQuery) return fromQuery;

  const fromEnv = configuredRoomServerUrl();
  if (fromEnv) return fromEnv;

  const host = window.location.hostname || "127.0.0.1";
  if (host === "localhost" || host === "127.0.0.1") {
    return "ws://127.0.0.1:4000";
  }

  // Same-host LAN fallback (dev:web --host); Vercel needs VITE_ROOM_SERVER_URL.
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${host}:4000`;
}

export function lobbiesHttpUrl(wsUrl: string): string {
  try {
    const u = new URL(wsUrl);
    u.protocol = u.protocol === "wss:" ? "https:" : "http:";
    u.pathname = "/api/lobbies";
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return "";
  }
}

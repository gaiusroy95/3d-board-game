import {
  defaultRoomServerUrl,
  type ClientToServer,
  type LobbySummary,
  type RoomPlayerInfo,
  type ServerToClient,
} from "./roomProtocol";

export type RoomClientHandlers = {
  onLobbies?: (lobbies: readonly LobbySummary[]) => void;
  onJoined?: (info: {
    roomCode: string;
    lobbyName: string;
    playerId: string;
    hostId: string;
    players: readonly RoomPlayerInfo[];
  }) => void;
  onLeft?: () => void;
  onRoster?: (players: readonly RoomPlayerInfo[], hostId: string) => void;
  onStart?: (info: {
    roomCode: string;
    lobbyName?: string;
    hostId: string;
    players: readonly RoomPlayerInfo[];
  }) => void;
  onActionFrom?: (fromPlayerId: string, action: unknown) => void;
  onState?: (payload: Extract<ServerToClient, { type: "state" }>) => void;
  onDisconnectPlayer?: (playerId: string, hostId: string) => void;
  onChat?: (from: string, text: string) => void;
  onError?: (reason: string) => void;
  onConnection?: (status: "connecting" | "open" | "closed") => void;
};

export class RoomClient {
  private ws: WebSocket | null = null;
  private readonly url: string;
  private pending: ClientToServer[] = [];
  handlers: RoomClientHandlers;

  constructor(handlers: RoomClientHandlers, url: string = defaultRoomServerUrl()) {
    this.handlers = handlers;
    this.url = url;
  }

  get serverUrl(): string {
    return this.url;
  }

  connect(): void {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    this.handlers.onConnection?.("connecting");
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.handlers.onConnection?.("open");
      for (const msg of this.pending) {
        ws.send(JSON.stringify(msg));
      }
      this.pending = [];
    };
    ws.onclose = () => this.handlers.onConnection?.("closed");
    ws.onerror = () =>
      this.handlers.onError?.(
        `Cannot reach lobby server at ${this.url}. Deploy room-server (WSS) and set VITE_ROOM_SERVER_URL.`,
      );
    ws.onmessage = (ev) => {
      let msg: ServerToClient;
      try {
        msg = JSON.parse(String(ev.data)) as ServerToClient;
      } catch {
        this.handlers.onError?.("Bad message from server.");
        return;
      }
      switch (msg.type) {
        case "lobbies":
          this.handlers.onLobbies?.(msg.lobbies);
          break;
        case "joined":
          this.handlers.onJoined?.(msg);
          break;
        case "left":
          this.handlers.onLeft?.();
          break;
        case "roster":
          this.handlers.onRoster?.(msg.players, msg.hostId);
          break;
        case "start":
          this.handlers.onStart?.(msg);
          break;
        case "action_from":
          this.handlers.onActionFrom?.(msg.fromPlayerId, msg.action);
          break;
        case "state":
          this.handlers.onState?.(msg);
          break;
        case "disconnect":
          this.handlers.onDisconnectPlayer?.(msg.playerId, msg.hostId);
          break;
        case "chat":
          this.handlers.onChat?.(msg.from, msg.text);
          break;
        case "error":
          this.handlers.onError?.(msg.reason);
          break;
      }
    };
  }

  disconnect(): void {
    this.pending = [];
    this.ws?.close();
    this.ws = null;
  }

  send(msg: ClientToServer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      return;
    }
    if (this.ws?.readyState === WebSocket.CONNECTING) {
      this.pending.push(msg);
      return;
    }
    this.handlers.onError?.(
      `Cannot reach lobby server at ${this.url}. Deploy room-server (WSS) and set VITE_ROOM_SERVER_URL.`,
    );
  }
}

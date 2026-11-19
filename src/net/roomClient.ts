import {
  defaultRoomServerUrl,
  lobbiesHttpUrl,
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

async function wakeLobbyServer(wsUrl: string): Promise<void> {
  const httpUrl = lobbiesHttpUrl(wsUrl);
  if (!httpUrl) return;
  try {
    await fetch(httpUrl, { method: "GET", mode: "cors", cache: "no-store" });
  } catch {
    // Wake may fail while Render cold-starts; WebSocket retries handle that.
  }
}

export class RoomClient {
  private ws: WebSocket | null = null;
  private readonly url: string;
  private pending: ClientToServer[] = [];
  private intentionalClose = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;
  private connecting = false;
  handlers: RoomClientHandlers;

  constructor(handlers: RoomClientHandlers, url: string = defaultRoomServerUrl()) {
    this.handlers = handlers;
    this.url = url;
  }

  get serverUrl(): string {
    return this.url;
  }

  connect(): void {
    this.intentionalClose = false;
    void this.openSocket();
  }

  private async openSocket(): Promise<void> {
    if (
      this.connecting ||
      this.ws?.readyState === WebSocket.OPEN ||
      this.ws?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }
    this.connecting = true;
    this.handlers.onConnection?.("connecting");
    if (this.attempt > 0) {
      this.handlers.onError?.(
        `Lobby server waking up (Render free tier)… retry ${this.attempt}/8`,
      );
    }
    await wakeLobbyServer(this.url);
    if (this.intentionalClose) {
      this.connecting = false;
      return;
    }

    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.connecting = false;
      this.attempt = 0;
      this.handlers.onConnection?.("open");
      for (const msg of this.pending) {
        ws.send(JSON.stringify(msg));
      }
      this.pending = [];
    };
    ws.onclose = () => {
      this.connecting = false;
      this.handlers.onConnection?.("closed");
      this.ws = null;
      if (!this.intentionalClose) this.scheduleReconnect();
    };
    ws.onerror = () => {
      // Browser fires error before close; reconnect path reports status.
    };
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

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.intentionalClose) return;
    if (this.attempt >= 8) {
      this.handlers.onError?.(
        `Cannot reach lobby server at ${this.url}. Open /health on Render to wake it, then click Refresh.`,
      );
      return;
    }
    this.attempt += 1;
    const delay = Math.min(12_000, 1000 * 2 ** Math.min(this.attempt - 1, 3));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.openSocket();
    }, delay);
  }

  /** Force a fresh connect (used by Refresh). */
  reconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.intentionalClose = false;
    this.attempt = 0;
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.ws = null;
    void this.openSocket();
  }

  disconnect(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.pending = [];
    this.connecting = false;
    this.ws?.close();
    this.ws = null;
  }

  send(msg: ClientToServer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      return;
    }
    if (
      this.ws?.readyState === WebSocket.CONNECTING ||
      this.connecting ||
      this.reconnectTimer
    ) {
      this.pending.push(msg);
      return;
    }
    this.pending.push(msg);
    this.reconnect();
  }
}

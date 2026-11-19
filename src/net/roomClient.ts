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

/** Best-effort wake; never blocks WebSocket connect for long. */
async function wakeLobbyServer(wsUrl: string): Promise<void> {
  const httpUrl = lobbiesHttpUrl(wsUrl);
  if (!httpUrl) return;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    await fetch(httpUrl, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      signal: ctrl.signal,
    });
  } catch {
    /* ignore — WS path is authoritative */
  } finally {
    clearTimeout(timer);
  }
}

export class RoomClient {
  private ws: WebSocket | null = null;
  private readonly url: string;
  private pending: ClientToServer[] = [];
  private intentionalClose = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectWatchdog: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;
  private opening = false;
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

  private clearConnectWatchdog(): void {
    if (this.connectWatchdog) {
      clearTimeout(this.connectWatchdog);
      this.connectWatchdog = null;
    }
  }

  private async openSocket(): Promise<void> {
    if (this.intentionalClose) return;
    if (
      this.opening ||
      this.ws?.readyState === WebSocket.OPEN ||
      this.ws?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    this.opening = true;
    this.handlers.onConnection?.("connecting");
    if (this.attempt > 0) {
      this.handlers.onError?.(
        `Retrying lobby WebSocket (${this.attempt}/8) → ${this.url}`,
      );
    }

    // Wake in parallel with a hard cap; never stall forever on fetch.
    await wakeLobbyServer(this.url);
    if (this.intentionalClose) {
      this.opening = false;
      return;
    }

    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch (err) {
      this.opening = false;
      this.handlers.onError?.(
        `WebSocket constructor failed for ${this.url}: ${String(err)}`,
      );
      this.scheduleReconnect();
      return;
    }

    this.ws = ws;
    this.clearConnectWatchdog();
    this.connectWatchdog = setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      }
    }, 12_000);

    ws.onopen = () => {
      this.clearConnectWatchdog();
      this.opening = false;
      this.attempt = 0;
      this.handlers.onConnection?.("open");
      for (const msg of this.pending) {
        ws.send(JSON.stringify(msg));
      }
      this.pending = [];
    };

    ws.onclose = (ev) => {
      this.clearConnectWatchdog();
      this.opening = false;
      this.handlers.onConnection?.("closed");
      this.ws = null;
      if (!this.intentionalClose) {
        this.handlers.onError?.(
          `WebSocket closed (${ev.code}${ev.reason ? `: ${ev.reason}` : ""}). Reconnecting…`,
        );
        this.scheduleReconnect();
      }
    };

    ws.onerror = () => {
      // Close event follows; reconnect is scheduled there.
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
        `Cannot open WebSocket to ${this.url} from this browser. Check DevTools → Network → WS.`,
      );
      return;
    }
    this.attempt += 1;
    const delay = Math.min(10_000, 800 * 2 ** Math.min(this.attempt - 1, 3));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.openSocket();
    }, delay);
  }

  reconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.clearConnectWatchdog();
    this.intentionalClose = false;
    this.attempt = 0;
    this.opening = false;
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
    this.clearConnectWatchdog();
    this.pending = [];
    this.opening = false;
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.ws = null;
  }

  send(msg: ClientToServer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      return;
    }
    this.pending.push(msg);
    if (
      this.ws?.readyState !== WebSocket.CONNECTING &&
      !this.opening &&
      !this.reconnectTimer
    ) {
      this.reconnect();
    }
  }
}

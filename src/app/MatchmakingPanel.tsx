import { M3OnlineConfig } from "@domain/onlineConfig";
import {
  InMemoryPublicMatchmaking,
  type MatchmakingTicket,
  type ReadyMatchRoom,
} from "@interfaces/matchmaking";
import { useState } from "react";

interface MatchmakingPanelProps {
  onMatchReady: (room: ReadyMatchRoom, localPlayerId: string) => void;
}

const queueSingleton = new InMemoryPublicMatchmaking();

export function MatchmakingPanel({ onMatchReady }: MatchmakingPanelProps) {
  const [name, setName] = useState("Player");
  const [ticket, setTicket] = useState<MatchmakingTicket | null>(null);
  const [queueSize, setQueueSize] = useState(0);
  const [status, setStatus] = useState(
    "Public matchmaking — Steam login later when App ID is ready.",
  );

  const refresh = () => setQueueSize(queueSingleton.getQueue().length);

  const joinQueue = () => {
    const id = `p-${Date.now().toString(36)}`;
    const t = queueSingleton.enqueue({
      id,
      displayName: name.trim() || "Player",
      steamId: null,
      ready: false,
    });
    setTicket(t);
    setStatus(`Queued as ${t.player.displayName}. Mark ready when set.`);
    refresh();
  };

  const toggleReady = () => {
    if (!ticket) return;
    const nextReady = !ticket.player.ready;
    queueSingleton.setReady(ticket.ticketId, nextReady);
    setTicket({
      ...ticket,
      player: { ...ticket.player, ready: nextReady },
    });
    if (nextReady) {
      // Demo: pad with bots so a solo client can form a 4-pack locally
      fillDemoBots(ticket.player.id);
    }
    const room = queueSingleton.tryFormRoom();
    refresh();
    if (room) {
      setStatus(
        `Room ${room.roomId} ready — starting match.`,
      );
      onMatchReady(room, ticket.player.id);
      return;
    }
    setStatus(nextReady ? "Ready — waiting for 4 ready players." : "Not ready.");
  };

  return (
    <section className="state-panel matchmaking-panel" aria-label="Matchmaking">
      <h2>Solo bot demo (1 PC)</h2>
      <p>
        Pads with 3 bots when you Ready — useful alone. For 4 real players use{" "}
        <strong>Public lobbies</strong> above.
      </p>
      <p className="muted tiny">{status}</p>
      <p className="muted tiny">Queue size: {queueSize}</p>
      {!ticket ? (
        <div className="hand-actions">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Display name"
            className="amount-input"
          />
          <button type="button" className="hud-button primary" onClick={joinQueue}>
            Find match (bots)
          </button>
        </div>
      ) : (
        <button type="button" className="hud-button accent" onClick={toggleReady}>
          {ticket.player.ready ? "Unready" : "Ready"}
        </button>
      )}
      <p className="muted tiny" style={{ marginTop: "0.75rem" }}>
        {M3OnlineConfig.playersPerMatch} seats · Steam matchmaking later (App ID)
      </p>
    </section>
  );
}

/** Local demo helper: pad queue to 4 ready so solo testing works. */
function fillDemoBots(humanId: string): void {
  const need =
    M3OnlineConfig.playersPerMatch -
    queueSingleton.getQueue().filter((t) => t.player.ready).length;
  for (let i = 0; i < need; i++) {
    const bot = queueSingleton.enqueue({
      id: `bot-${humanId}-${i}-${Date.now()}`,
      displayName: `Bot ${i + 1}`,
      steamId: null,
      ready: true,
    });
    queueSingleton.setReady(bot.ticketId, true);
  }
}

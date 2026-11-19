import { describe, expect, it } from "vitest";
import {
  acceptCashBorrowOffer,
  postCashBorrowOffer,
  ratesForBorrowOrdinal,
} from "@domain/borrows";
import { createFourPlayerMatch } from "@domain/match";
import { M3OnlineConfig } from "@domain/onlineConfig";
import {
  applyDisconnectKnockout,
  canViewBoard,
  createOnlineMeta,
  forceEndTurnIfTimedOut,
  startTurnTimer,
} from "@domain/onlineSession";
import { DedicatedMatchServer } from "@interfaces/dedicatedServer";
import { InMemoryPublicMatchmaking } from "@interfaces/matchmaking";

describe("M3 online + borrow offers", () => {
  it("config matches client A–C answers", () => {
    expect(M3OnlineConfig.platforms).toEqual(["windows", "mac"]);
    expect(M3OnlineConfig.requiresSteam).toBe(true);
    expect(M3OnlineConfig.matchmakingMode).toBe("public");
    expect(M3OnlineConfig.playersPerMatch).toBe(4);
    expect(M3OnlineConfig.authority).toBe("host-authoritative");
    expect(M3OnlineConfig.dedicatedBackendMilestone).toBe(4);
    expect(M3OnlineConfig.disconnectCountsAsKnockout).toBe(true);
    expect(M3OnlineConfig.turnTimeoutMs).toBe(180_000);
    expect(M3OnlineConfig.spectatorRole).toBe("admin-only");
    expect(M3OnlineConfig.playerViewMode).toBe("own-board");
  });

  it("public matchmaking forms a room when 4 are ready", () => {
    const mm = new InMemoryPublicMatchmaking();
    for (let i = 0; i < 4; i++) {
      const t = mm.enqueue({
        id: `p${i}`,
        displayName: `P${i}`,
        steamId: null,
        ready: true,
      });
      mm.setReady(t.ticketId, true);
    }
    const room = mm.tryFormRoom();
    expect(room).not.toBeNull();
    expect(room!.players).toHaveLength(4);
  });

  it("disconnect counts as knockout", () => {
    const match = createFourPlayerMatch({
      matchId: "ko",
      players: [
        { id: "p1", displayName: "A" },
        { id: "p2", displayName: "B" },
        { id: "p3", displayName: "C" },
        { id: "p4", displayName: "D" },
      ],
    });
    const result = applyDisconnectKnockout(match, "p2");
    expect(result.state.players.find((p) => p.id === "p2")!.lives).toBe(0);
    expect(result.state.playersKnockedOut).toBe(1);
  });

  it("own-board view hides other boards for players; admin sees all", () => {
    const player = createOnlineMeta("p1", "player");
    expect(canViewBoard(player, "p1")).toBe(true);
    expect(canViewBoard(player, "p2")).toBe(false);
    const admin = createOnlineMeta("admin", "admin-spectator");
    expect(canViewBoard(admin, "p2")).toBe(true);
  });

  it("forces end turn when timer expires", () => {
    const match = createFourPlayerMatch({
      matchId: "t",
      players: [
        { id: "p1", displayName: "A" },
        { id: "p2", displayName: "B" },
        { id: "p3", displayName: "C" },
        { id: "p4", displayName: "D" },
      ],
    });
    const meta = startTurnTimer(createOnlineMeta("p1"), 1_000);
    const forced = forceEndTurnIfTimedOut(match, meta, 1_000 + 180_000 + 1);
    expect(forced.forced).toBe(true);
    expect(forced.state.levelTurn.activePlayerIndex).not.toBe(0);
  });

  it("dedicated server rejects actions off-turn", () => {
    const server = new DedicatedMatchServer([
      { id: "p1", displayName: "A", ready: true, steamId: null },
      { id: "p2", displayName: "B", ready: true, steamId: null },
      { id: "p3", displayName: "C", ready: true, steamId: null },
      { id: "p4", displayName: "D", ready: true, steamId: null },
    ]);
    const result = server.dispatch({ type: "end-turn", playerId: "p2" });
    expect(result.ok).toBe(false);
  });

  it("borrow rates follow active count bands", () => {
    expect(ratesForBorrowOrdinal(1)).toEqual({
      defaultRate: 40,
      lowerRate: null,
    });
    expect(ratesForBorrowOrdinal(4)).toEqual({
      defaultRate: 50,
      lowerRate: 30,
    });
    expect(ratesForBorrowOrdinal(6)).toEqual({
      defaultRate: 60,
      lowerRate: 40,
    });
  });

  it("lender offers cash; borrower selects amount", () => {
    let match = createFourPlayerMatch({
      matchId: "offer",
      players: [
        { id: "p1", displayName: "A" },
        { id: "p2", displayName: "B" },
        { id: "p3", displayName: "C" },
        { id: "p4", displayName: "D" },
      ],
    });
    match = {
      ...match,
      players: match.players.map((p) =>
        p.id === "p2" ? { ...p, cash: 5000 } : p,
      ),
    };
    const offered = postCashBorrowOffer(match, "p2", 2000);
    expect(offered.ok).toBe(true);
    if (!offered.ok) return;
    const offerId = offered.state.cashBorrowOffers[0]!.id;
    const taken = acceptCashBorrowOffer(offered.state, "p1", offerId, 750);
    expect(taken.ok).toBe(true);
    if (!taken.ok) return;
    expect(taken.state.players.find((p) => p.id === "p1")!.cash).toBe(1750);
    expect(taken.state.cashBorrowOffers[0]!.principalRemaining).toBe(1250);
  });
});

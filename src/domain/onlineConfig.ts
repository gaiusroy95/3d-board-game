/**
 * Milestone 3 online rules — from client answers A–C.
 * Steam App ID / live hosting still pending client Steam account + D–E answers.
 */
export const M3OnlineConfig = {
  platforms: ["windows", "mac"] as const,
  requiresSteam: true,
  matchmakingMode: "public" as const,
  /** Match starts only with exactly 4 ready players. */
  playersPerMatch: 4,
  startWhenReadyCount: 4,
  /**
   * Client: backend OK in M4; unclear dedicated vs host.
   * M3 uses host-authoritative (in-process host brain / Steam host later).
   */
  authority: "host-authoritative" as const,
  dedicatedBackendMilestone: 4 as const,
  /** Disconnect mid-match → knockout. */
  disconnectCountsAsKnockout: true,
  /** AFK / turn timer. */
  turnTimeoutMs: 3 * 60 * 1000,
  spectatorRole: "admin-only" as const,
  /** Normal players see their own board; admin can spectate all. */
  playerViewMode: "own-board" as const,
  friendsInviteInM3: false,
  tournamentMatchmakingContext: true,
} as const;

export type M3OnlineConfigType = typeof M3OnlineConfig;

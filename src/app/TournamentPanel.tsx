import type { Tournament, TournamentMatch, TournamentStageId } from "@domain/tournament";
import { listSchedule, stageLabel } from "@domain/tournamentOps";
import { phasePresetFor } from "@domain/tournamentPhase";
import type { StoreDiscountCode } from "@domain/storeDiscountCodes";
import { tournamentStore } from "@interfaces/tournamentAdmin";
import { useEffect, useState } from "react";

export interface TournamentPlayRequest {
  matchId: string;
  stageId: TournamentStageId;
}

interface TournamentPanelProps {
  onPlayPhaseMatch?: (request: TournamentPlayRequest) => void;
}

function nameOf(t: Tournament, playerId: string | null): string {
  if (!playerId) return "—";
  const fromRoster = t.roster.find((e) => e.playerId === playerId);
  if (fromRoster) return fromRoster.displayName;
  for (const stage of t.stages) {
    for (const match of stage.matches) {
      const p = match.participants.find((x) => x.playerId === playerId);
      if (p) return p.displayName;
    }
  }
  return playerId;
}

function toLocalInputValue(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function MatchRow({
  match,
  stageId,
  admin,
  onChanged,
  onPlay,
}: {
  match: TournamentMatch;
  stageId: TournamentStageId;
  admin: boolean;
  onChanged: (note: string) => void;
  onPlay?: (request: TournamentPlayRequest) => void;
}) {
  const when = match.schedule
    ? new Date(match.schedule.startsAtUtc).toLocaleString()
    : "Unscheduled";
  const preset = phasePresetFor(stageId);

  return (
    <li style={{ flexDirection: "column", alignItems: "stretch", gap: "0.35rem" }}>
      <span>
        <strong>{match.id}</strong>
        <span className="muted tiny">
          {" "}
          · {match.status}
          {match.winnerPlayerId
            ? ` · winner ${match.participants.find((p) => p.playerId === match.winnerPlayerId)?.displayName ?? match.winnerPlayerId}`
            : ""}
        </span>
        <br />
        <span className="muted tiny">
          {match.participants.length
            ? match.participants
                .map(
                  (p) =>
                    `${p.displayName}${p.knockedOut ? " (KO)" : ""}`,
                )
                .join(" · ")
            : "Seats empty"}
        </span>
        <br />
        <span className="muted tiny">
          {when} · phase: {preset.label} (cash {preset.startingCash}, figurines{" "}
          {preset.ownedFigurines} = {preset.startingFigurinePoints} pts)
        </span>
      </span>
      {admin && match.status !== "completed" && (
        <div className="hand-actions" style={{ flexWrap: "wrap" }}>
          <input
            type="datetime-local"
            className="amount-input"
            aria-label={`Schedule ${match.id}`}
            defaultValue={toLocalInputValue(match.schedule?.startsAtUtc)}
            onChange={(e) => {
              if (!e.target.value) return;
              const utc = new Date(e.target.value).toISOString();
              const r = tournamentStore.setMatchTime(match.id, utc);
              onChanged(r.ok ? r.note : r.reason);
            }}
          />
          {match.participants
            .filter((p) => !p.knockedOut)
            .map((p) => (
              <button
                key={p.playerId}
                type="button"
                className="hud-button ghost compact"
                title="No-show / late / disconnect → knockout"
                onClick={() => {
                  const r = tournamentStore.noShow(match.id, p.playerId);
                  onChanged(r.ok ? r.note : r.reason);
                }}
              >
                KO {p.displayName}
              </button>
            ))}
          {match.status === "ready" && match.participants.length === 4 && (
            <>
              {onPlay && (
                <button
                  type="button"
                  className="hud-button primary compact"
                  onClick={() => onPlay({ matchId: match.id, stageId })}
                >
                  Play match
                </button>
              )}
              <button
                type="button"
                className="hud-button accent compact"
                onClick={() => {
                  const r = tournamentStore.simulateWinner(match.id);
                  onChanged(r.ok ? r.note : r.reason);
                }}
              >
                Record winner
              </button>
            </>
          )}
        </div>
      )}
    </li>
  );
}

export function TournamentPanel({ onPlayPhaseMatch }: TournamentPanelProps) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [name, setName] = useState("Street Cup");
  const [entrantName, setEntrantName] = useState("");
  const [status, setStatus] = useState(
    "Create a cup, fill the roster, then run the bracket. No-show, late, or disconnect = knockout.",
  );
  const [adminOpen, setAdminOpen] = useState(false);
  const [codes, setCodes] = useState<StoreDiscountCode[]>([]);

  const refresh = (note?: string) => {
    setTournament(tournamentStore.getActive());
    setCodes(tournamentStore.listDiscountCodes());
    if (note) setStatus(note);
  };

  useEffect(() => {
    tournamentStore.loadFromStorage();
    refresh();
  }, []);

  const t = tournament;
  const schedule = t ? listSchedule(t) : [];

  return (
    <section
      className={`state-panel lobby-card matchmaking-panel${t ? " lobby-card--wide" : ""}`}
      aria-label="Tournament"
    >
      <p className="lobby-card-kicker">Competition</p>
      <h2>Tournament</h2>
      <p className="lobby-card-lead">
        Admin-run bracket <strong>64 → 16 → 4 → 1</strong> with public schedule and
        standings.
      </p>
      <p className="muted tiny">{status}</p>

      {!t ? (
        <div className="hand-actions" style={{ flexWrap: "wrap" }}>
          <input
            className="amount-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Tournament name"
            placeholder="Tournament name"
          />
          <button
            type="button"
            className="hud-button primary"
            onClick={() => {
              const r = tournamentStore.createNew(name);
              refresh(r.ok ? r.note : r.reason);
            }}
          >
            Create tournament
          </button>
        </div>
      ) : (
        <>
          <p>
            <strong>{t.name}</strong>
            <span className="muted tiny">
              {" "}
              · {t.status} · roster {t.roster.length}/64 · schedule TZ{" "}
              {t.scheduleTimezone} (shown in your local time)
            </span>
          </p>

          {t.status === "completed" && (
            <div className="pending-card">
              <p className="ledger-title">Standings</p>
              <ol className="loan-list">
                <li>
                  <span>1st — {nameOf(t, t.standings.firstPlayerId)}</span>
                </li>
                <li>
                  <span>2nd — {nameOf(t, t.standings.secondPlayerId)}</span>
                </li>
                <li>
                  <span>3rd — {nameOf(t, t.standings.thirdPlayerId)}</span>
                </li>
              </ol>
            </div>
          )}

          <h3 className="muted tiny">Schedule (everyone)</h3>
          {schedule.length === 0 ? (
            <p className="muted tiny">No scheduled matches yet.</p>
          ) : (
            <ul className="loan-list">
              {schedule.map((s) => (
                <li key={s.id}>
                  <span>
                    {s.label}
                    <span className="muted tiny">
                      {" "}
                      · {new Date(s.startsAtUtc).toLocaleString()}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h3 className="muted tiny">Bracket</h3>
          {t.stages.map((stage) => {
            const seated = stage.matches.some((m) => m.participants.length > 0);
            return (
              <div key={stage.id} className="lobby-bracket-stage">
                <p className="ledger-sub">
                  {stageLabel(stage.id)} — {stage.phaseSettings.label}
                </p>
                <p className="muted tiny">{stage.phaseSettings.notes}</p>
                {!seated ? (
                  <p className="muted tiny lobby-bracket-empty">
                    {stage.matchCount} matches · seats fill when the stage starts
                  </p>
                ) : (
                  <ul className="loan-list">
                    {stage.matches.map((m) => (
                      <MatchRow
                        key={m.id}
                        match={m}
                        stageId={stage.id}
                        admin={adminOpen}
                        onChanged={(note) => refresh(note)}
                        {...(onPlayPhaseMatch
                          ? { onPlay: onPlayPhaseMatch }
                          : {})}
                      />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}

          <button
            type="button"
            className="hud-button ghost"
            onClick={() => setAdminOpen((v) => !v)}
          >
            {adminOpen ? "Hide admin" : "Admin tools"}
          </button>

          {adminOpen && (
            <div className="pending-card" style={{ marginTop: "0.75rem" }}>
              <p className="muted tiny">
                One cup at a time. No pause or cancel. Results lock once recorded.
                No-show / late / disconnect = knockout (use KO on each match).
              </p>

              {(t.status === "registration" || t.status === "ready") && (
                <>
                  <div className="hand-actions" style={{ flexWrap: "wrap" }}>
                    <input
                      className="amount-input"
                      value={entrantName}
                      onChange={(e) => setEntrantName(e.target.value)}
                      placeholder="Player name"
                      aria-label="Register player"
                    />
                    <button
                      type="button"
                      className="hud-button accent"
                      onClick={() => {
                        const displayName =
                          entrantName.trim() || `Player ${t.roster.length + 1}`;
                        const r = tournamentStore.register({
                          playerId: `p-${Date.now().toString(36)}`,
                          displayName,
                        });
                        setEntrantName("");
                        refresh(r.ok ? r.note : r.reason);
                      }}
                    >
                      Register
                    </button>
                    <button
                      type="button"
                      className="hud-button primary"
                      onClick={() => {
                        const r = tournamentStore.fillPlaceholders();
                        refresh(r.ok ? r.note : r.reason);
                      }}
                    >
                      Fill to 64
                    </button>
                  </div>
                  <button
                    type="button"
                    className="hud-button primary"
                    style={{ marginTop: "0.5rem" }}
                    disabled={t.roster.length !== 64}
                    onClick={() => {
                      const r = tournamentStore.start();
                      refresh(r.ok ? r.note : r.reason);
                    }}
                  >
                    Start (random seat Round 1)
                  </button>
                </>
              )}

              <div style={{ marginTop: "0.75rem" }}>
                <p className="ledger-sub">Store discount codes (−25%)</p>
                <p className="muted tiny">
                  Share codes for a 25% store discount.
                </p>
                <button
                  type="button"
                  className="hud-button accent compact"
                  onClick={() => {
                    const code = tournamentStore.createDiscountCode(25);
                    refresh(`Discount code ${code.code} (−${code.percentOff}%).`);
                  }}
                >
                  Generate 25% code
                </button>
                {codes.length > 0 && (
                  <ul className="loan-list" style={{ marginTop: "0.35rem" }}>
                    {codes.slice(0, 5).map((c) => (
                      <li key={c.code}>
                        <span>
                          <code>{c.code}</code>
                          <span className="muted tiny"> −{c.percentOff}%</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <button
                type="button"
                className="hud-button ghost"
                style={{ marginTop: "0.5rem" }}
                onClick={() => {
                  tournamentStore.clearDemo();
                  refresh("Tournament cleared.");
                }}
              >
                Clear tournament
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

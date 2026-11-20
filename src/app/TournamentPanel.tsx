import type { Tournament, TournamentMatch } from "@domain/tournament";
import { listSchedule, stageLabel } from "@domain/tournamentOps";
import { tournamentStore } from "@interfaces/tournamentAdmin";
import { useEffect, useState } from "react";

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
  admin,
  onChanged,
}: {
  match: TournamentMatch;
  admin: boolean;
  onChanged: (note: string) => void;
}) {
  const when = match.schedule
    ? new Date(match.schedule.startsAtUtc).toLocaleString()
    : "Unscheduled";

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
        <span className="muted tiny">{when}</span>
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
          {match.status === "ready" && match.participants.length === 4 && (
            <button
              type="button"
              className="hud-button accent compact"
              onClick={() => {
                const r = tournamentStore.simulateWinner(match.id);
                onChanged(r.ok ? r.note : r.reason);
              }}
            >
              Record demo winner
            </button>
          )}
        </div>
      )}
    </li>
  );
}

export function TournamentPanel() {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [name, setName] = useState("Street Cup");
  const [entrantName, setEntrantName] = useState("");
  const [status, setStatus] = useState(
    "Milestone 4 tournament — bracket & schedule (Steam match launch pending App ID).",
  );
  const [adminOpen, setAdminOpen] = useState(false);

  const refresh = (note?: string) => {
    setTournament(tournamentStore.getActive());
    if (note) setStatus(note);
  };

  useEffect(() => {
    tournamentStore.loadFromStorage();
    refresh();
  }, []);

  const t = tournament;
  const schedule = t ? listSchedule(t) : [];

  return (
    <section className="state-panel matchmaking-panel" aria-label="Tournament">
      <h2>Tournament (Milestone 4)</h2>
      <p>
        Admin-managed <strong>64 → 16 → 4 → 1</strong>. Public bracket &amp; schedule.
        Match play on Steam waits for App ID — demo can record winners to advance the
        bracket.
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
              · {t.status} · roster {t.roster.length}/64 · TZ {t.scheduleTimezone}
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
          {t.stages.map((stage) => (
            <div key={stage.id} style={{ marginBottom: "0.75rem" }}>
              <p className="ledger-sub">
                {stageLabel(stage.id)} — {stage.phaseSettings.label}
              </p>
              <p className="muted tiny">{stage.phaseSettings.notes}</p>
              <ul className="loan-list">
                {stage.matches.map((m) => (
                  <MatchRow
                    key={m.id}
                    match={m}
                    admin={adminOpen}
                    onChanged={(note) => refresh(note)}
                  />
                ))}
              </ul>
            </div>
          ))}

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
                Admin demo controls (Steam login OPEN). One tournament only; no
                pause/cancel. Results cannot be overridden once recorded.
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
                        const displayName = entrantName.trim() || `Player ${t.roster.length + 1}`;
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
                      Fill to 64 (demo)
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

              {t.status === "running" && (
                <p className="muted tiny">
                  Use <strong>Record demo winner</strong> on ready matches to advance.
                  Steam match launch later. Knockout = mark via code path (late/disconnect).
                </p>
              )}

              <button
                type="button"
                className="hud-button ghost"
                style={{ marginTop: "0.5rem" }}
                onClick={() => {
                  tournamentStore.clearDemo();
                  refresh("Cleared local demo tournament.");
                }}
              >
                Clear demo tournament
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

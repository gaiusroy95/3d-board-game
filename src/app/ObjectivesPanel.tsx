import {
  ANYTIME_OBJECTIVES,
  MAX_RACE_OBJECTIVE_SELECTIONS,
  RACE_OBJECTIVES,
  deselectRaceObjective,
  selectRaceObjective,
  tryClaimAnytimeObjective,
  tryClaimRaceObjective,
  type AnytimeObjectiveId,
  type RaceObjectiveId,
} from "@domain/objectives";
import { getActivePlayerId, scoreForPlayer, type MatchState } from "@domain/match";

interface ObjectivesPanelProps {
  match: MatchState;
  onMatchChange: (match: MatchState, note: string) => void;
}

export function ObjectivesPanel({ match, onMatchChange }: ObjectivesPanelProps) {
  const activeId = getActivePlayerId(match);
  const active = match.players.find((p) => p.id === activeId);
  if (!active) return null;

  const selected = active.selectedRaceObjectives;
  const windowOpen = match.objectives.selectWindowOpened;
  const turnsLeft = match.objectives.selectTurnsRemaining;
  const canSelect =
    selected.length < MAX_RACE_OBJECTIVE_SELECTIONS &&
    (!windowOpen || turnsLeft === null || turnsLeft > 0);

  return (
    <section className="side-panel objectives-panel" aria-label="Objectives">
      <h3>Objectives</h3>
      <p className="muted tiny">
        Pick up to {MAX_RACE_OBJECTIVE_SELECTIONS} of 7 races (+5 each). Money &amp; survival
        claim anytime (+5).
      </p>
      {windowOpen && (
        <p className="muted tiny select-window">
          Select window open
          {turnsLeft != null ? ` · ${turnsLeft} turn(s) left` : ""} (triggered at 20 pts).
        </p>
      )}
      <p className="muted tiny">
        Your objective pts: <strong>{active.objectivePoints}</strong> · total{" "}
        <strong>{scoreForPlayer(match, activeId)}</strong>
      </p>

      <h4>Race (select ≤{MAX_RACE_OBJECTIVE_SELECTIONS})</h4>
      <ul className="objective-list">
        {RACE_OBJECTIVES.map((def) => {
          const id = def.id as RaceObjectiveId;
          const isSelected = selected.includes(id);
          const claimedBy = match.objectives.raceClaimedBy[id];
          return (
            <li key={id} className={claimedBy ? "is-claimed" : isSelected ? "is-selected" : ""}>
              <div>
                <strong>{def.title}</strong>
                <div className="muted tiny">{def.description}</div>
                {claimedBy && (
                  <div className="muted tiny">Claimed by {claimedBy}</div>
                )}
              </div>
              <div className="hand-actions">
                {!claimedBy && (
                  <button
                    type="button"
                    className="hud-button compact"
                    disabled={isSelected ? false : !canSelect}
                    onClick={() => {
                      const result = isSelected
                        ? deselectRaceObjective(match, activeId, id)
                        : selectRaceObjective(match, activeId, id);
                      onMatchChange(
                        result.state,
                        result.ok ? result.note : result.reason,
                      );
                    }}
                  >
                    {isSelected ? "Drop" : "Pick"}
                  </button>
                )}
                {isSelected && !claimedBy && (
                  <button
                    type="button"
                    className="hud-button compact"
                    onClick={() => {
                      const result = tryClaimRaceObjective(match, activeId, id);
                      onMatchChange(
                        result.state,
                        result.ok ? result.note : result.reason,
                      );
                    }}
                  >
                    Claim
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <h4>Anytime</h4>
      <ul className="objective-list">
        {ANYTIME_OBJECTIVES.map((def) => {
          const id = def.id as AnytimeObjectiveId;
          const claimed = match.objectives.anytimeClaimedBy[id] ?? [];
          const mine = claimed.includes(activeId);
          return (
            <li key={id} className={mine ? "is-claimed" : ""}>
              <div>
                <strong>{def.title}</strong>
                <div className="muted tiny">{def.description}</div>
                {claimed.length > 0 && (
                  <div className="muted tiny">Taken: {claimed.join(", ")}</div>
                )}
              </div>
              {!mine && (
                <button
                  type="button"
                  className="hud-button compact"
                  onClick={() => {
                    const result = tryClaimAnytimeObjective(match, activeId, id);
                    onMatchChange(
                      result.state,
                      result.ok ? result.note : result.reason,
                    );
                  }}
                >
                  Claim
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <p className="muted tiny">
        Progress — builds {active.objectiveStats.buildsPlaced} · skills used{" "}
        {active.objectiveStats.skillsUsed} · specials{" "}
        {active.objectiveStats.specialCardsPlayed} · borrow cash{" "}
        {active.objectiveStats.moneyFromBorrows} · skill cash{" "}
        {active.objectiveStats.moneyFromSkills}
      </p>
    </section>
  );
}

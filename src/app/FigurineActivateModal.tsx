import {
  applyFigurineActivation,
  getLearnStateForSlot,
} from "@domain/figurineActivation";
import { getFigurineConfig } from "@domain/figurineConfig";
import { learnFigurineSkill } from "@domain/figurines";
import type { MatchState } from "@domain/match";
import type { FigurinePopupState } from "./matchUi";

interface FigurineActivateModalProps {
  match: MatchState;
  popup: FigurinePopupState;
  onClose: () => void;
  onMatchChange: (match: MatchState, message: string) => void;
}

export function FigurineActivateModal({
  match,
  popup,
  onClose,
  onMatchChange,
}: FigurineActivateModalProps) {
  const learn = getLearnStateForSlot(match, popup.ownerId, popup.slotIndex);
  const cfg = getFigurineConfig(popup.slotIndex);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-labelledby="figurine-activate-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="figurine-activate-title">Figurine {popup.slotIndex + 1}</h2>
        <p>
          {popup.ownerId} — activated, never moved. Choose one skill to learn, then use it.
        </p>
        <p className="muted">
          Learn {cfg.learnCost} · Activate {cfg.activateCost}. Unlock: {cfg.unlockSummary}
        </p>
        <p className="muted tiny">Reward: {cfg.rewardSummary}</p>
        <div className="modal-actions">
          <button
            type="button"
            className="hud-button"
            disabled={learn.skill1Learned || learn.skill2Learned}
            onClick={() => {
              const result = learnFigurineSkill(
                match,
                popup.ownerId,
                popup.slotIndex,
                "skill1",
              );
              onMatchChange(
                result.state,
                result.ok ? result.note : result.reason,
              );
            }}
          >
            Learn skill 1 — {cfg.skillSummaries[0]}
          </button>
          <button
            type="button"
            className="hud-button"
            disabled={learn.skill2Learned || learn.skill1Learned}
            onClick={() => {
              const result = learnFigurineSkill(
                match,
                popup.ownerId,
                popup.slotIndex,
                "skill2",
              );
              onMatchChange(
                result.state,
                result.ok ? result.note : result.reason,
              );
            }}
          >
            Learn skill 2 — {cfg.skillSummaries[1]}
          </button>
          <button
            type="button"
            className="hud-button"
            disabled={!learn.skill1Learned}
            onClick={() => {
              const result = applyFigurineActivation(match, {
                actorId: popup.ownerId,
                slotIndex: popup.slotIndex,
                skillId: "skill1",
              });
              onMatchChange(
                result.state,
                result.ok ? result.note : result.reason,
              );
            }}
          >
            Use skill 1
          </button>
          <button
            type="button"
            className="hud-button"
            disabled={!learn.skill2Learned}
            onClick={() => {
              const result = applyFigurineActivation(match, {
                actorId: popup.ownerId,
                slotIndex: popup.slotIndex,
                skillId: "skill2",
              });
              onMatchChange(
                result.state,
                result.ok ? result.note : result.reason,
              );
            }}
          >
            Use skill 2
          </button>
          <button type="button" className="hud-button ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

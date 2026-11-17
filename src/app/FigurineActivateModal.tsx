import {
  applyFigurineActivationNoOp,
  getLearnStateForSlot,
} from "@domain/figurineActivation";
import type { MatchState } from "@domain/match";
import type { FigurinePopupState } from "./matchUi";

interface FigurineActivateModalProps {
  match: MatchState;
  popup: FigurinePopupState;
  onClose: () => void;
  onResult: (message: string) => void;
}

/**
 * Client: popup with 2 skill buttons when skills are learned.
 * Milestone 1 stub — does not grant rewards or charge cash.
 */
export function FigurineActivateModal({
  match,
  popup,
  onClose,
  onResult,
}: FigurineActivateModalProps) {
  const learn = getLearnStateForSlot(match, popup.ownerId, popup.slotIndex);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-labelledby="figurine-activate-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="figurine-activate-title">Activate figurine</h2>
        <p>
          {popup.ownerId} · slot {popup.slotIndex + 1}. Figurines are activated, not moved.
        </p>
        <p className="muted">
          TODO (client): learn cost, activation cost, and reward amounts (figurine + skill).
        </p>
        <div className="modal-actions">
          <button
            type="button"
            className="hud-button"
            disabled={!learn.skill1Learned}
            onClick={() => {
              const result = applyFigurineActivationNoOp(match, {
                actorId: popup.ownerId,
                slotIndex: popup.slotIndex,
                skillId: "skill1",
              });
              onResult(result.ok ? result.note : result.reason);
            }}
          >
            Use skill 1
          </button>
          <button
            type="button"
            className="hud-button"
            disabled={!learn.skill2Learned}
            onClick={() => {
              const result = applyFigurineActivationNoOp(match, {
                actorId: popup.ownerId,
                slotIndex: popup.slotIndex,
                skillId: "skill2",
              });
              onResult(result.ok ? result.note : result.reason);
            }}
          >
            Use skill 2
          </button>
          <button type="button" className="hud-button ghost" onClick={onClose}>
            Close
          </button>
        </div>
        {!learn.skill1Learned && !learn.skill2Learned && (
          <p className="muted">No skills learned for this figurine yet.</p>
        )}
      </div>
    </div>
  );
}

import { listLoanOffers, repayLoan, takeLoan } from "@domain/bankLoans";
import {
  grantBoardBuildPermit,
  listBorrowCapacity,
  takePlayerBorrow,
} from "@domain/borrows";
import { getActivePlayerId, type MatchState } from "@domain/match";

interface LoanPanelProps {
  match: MatchState;
  onMatchChange: (match: MatchState, note: string) => void;
}

export function LoanPanel({ match, onMatchChange }: LoanPanelProps) {
  const activeId = getActivePlayerId(match);
  const offers = listLoanOffers(match, activeId);
  const myLoans = match.activeLoans.filter((l) => l.borrowerId === activeId);
  const cap = listBorrowCapacity(match, activeId);
  const others = match.players.filter((p) => p.id !== activeId);

  return (
    <section className="side-panel loan-panel" aria-label="Bank loans">
      <h3>Bank loans</h3>
      <p className="muted tiny">Only 1 borrow from Bank per player.</p>
      <p className="muted tiny">
        Non-bank: {cap.used}/{cap.max} · default +{cap.defaultRate}%
        {cap.lowerRate != null
          ? ` · pay ${cap.lowerRateUnlockFeePct * 100}% of principal → +${cap.lowerRate}%`
          : ""}
      </p>

      <ul className="loan-list">
        {offers.map((offer) => (
          <li key={offer.button}>
            <div>
              <strong>
                {offer.label}: {offer.principal}
              </strong>
              <span className="muted">
                {" "}
                repay +{offer.repaymentPremiumPercent}%
              </span>
              <div className="muted tiny">{offer.formulaNote}</div>
              {!offer.enabled && offer.disabledReason && (
                <div className="muted tiny">{offer.disabledReason}</div>
              )}
            </div>
            <button
              type="button"
              className="hud-button compact"
              disabled={!offer.enabled || offer.principal <= 0}
              onClick={() => {
                const result = takeLoan(match, activeId, offer.button);
                onMatchChange(
                  result.state,
                  result.ok ? result.note : result.reason,
                );
              }}
            >
              Borrow
            </button>
          </li>
        ))}
      </ul>

      {myLoans.length > 0 && (
        <>
          <h4>Active bank loans</h4>
          <ul className="loan-list">
            {myLoans.map((loan) => (
              <li key={`${loan.button}-${loan.repaymentDue}`}>
                <span>
                  Button {loan.button}: due {loan.repaymentDue}
                </span>
                <button
                  type="button"
                  className="hud-button compact"
                  onClick={() => {
                    const result = repayLoan(match, activeId, loan.button);
                    onMatchChange(
                      result.state,
                      result.ok ? result.note : result.reason,
                    );
                  }}
                >
                  Repay
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <h4>Type 1 — player cash borrow</h4>
      <ul className="loan-list">
        {others.map((lender) => (
          <li key={lender.id}>
            <span>From {lender.displayName} (500)</span>
            <span className="hand-actions">
              <button
                type="button"
                className="hud-button compact"
                disabled={cap.used >= cap.max}
                onClick={() => {
                  const result = takePlayerBorrow(
                    match,
                    activeId,
                    lender.id,
                    500,
                    match.turnIndex + 4,
                    { unlockLowerRate: false },
                  );
                  onMatchChange(
                    result.state,
                    result.ok ? result.note : result.reason,
                  );
                }}
              >
                +{cap.defaultRate}%
              </button>
              {cap.lowerRate != null && (
                <button
                  type="button"
                  className="hud-button compact ghost"
                  disabled={cap.used >= cap.max}
                  title={`Pay ${cap.lowerRateUnlockFeePct * 100}% of principal to unlock lower rate`}
                  onClick={() => {
                    const result = takePlayerBorrow(
                      match,
                      activeId,
                      lender.id,
                      500,
                      match.turnIndex + 4,
                      { unlockLowerRate: true },
                    );
                    onMatchChange(
                      result.state,
                      result.ok ? result.note : result.reason,
                    );
                  }}
                >
                  Pay {cap.lowerRateUnlockFeePct * 100}%→+{cap.lowerRate}%
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>

      <h4>Type 2 — allow build on my board</h4>
      <p className="muted tiny">
        Lets them build here; you get 20% of calculating rate each turn while it stands.
      </p>
      <ul className="loan-list">
        {others.map((builder) => (
          <li key={`permit-${builder.id}`}>
            <span>Permit {builder.displayName}</span>
            <button
              type="button"
              className="hud-button compact"
              onClick={() => {
                const result = grantBoardBuildPermit(
                  match,
                  activeId,
                  builder.id,
                );
                onMatchChange(
                  result.state,
                  result.ok ? result.note : result.reason,
                );
              }}
            >
              Allow
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

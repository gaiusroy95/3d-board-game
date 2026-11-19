import { listLoanOffers, repayLoan, takeLoan } from "@domain/bankLoans";
import {
  acceptCashBorrowOffer,
  grantBoardBuildPermit,
  listBorrowCapacity,
  postCashBorrowOffer,
} from "@domain/borrows";
import { getActivePlayerId, type MatchState } from "@domain/match";
import { useState } from "react";

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
  const [offerAmount, setOfferAmount] = useState(500);
  const [takeAmount, setTakeAmount] = useState(500);

  return (
    <section className="side-panel loan-panel" aria-label="Bank loans">
      <h3>Bank &amp; borrows</h3>
      <p className="muted tiny">One Bank borrow per player. Player loans &amp; board permits below.</p>
      <p className="muted tiny">
        Non-bank: {cap.used}/{cap.max} · next +{cap.defaultRate}%
        {cap.lowerRate != null
          ? ` (or +${cap.lowerRate}% if pay ${cap.lowerRateUnlockFeePct * 100}% of amount)`
          : ""}
        {" "}· #4–5 unlock with Deck 2
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

      <h4>Offer cash to lend</h4>
      <p className="muted tiny">
        Post an offer; on their turn another player selects how much to take (+{cap.defaultRate}% band for them).
      </p>
      <div className="hand-actions" style={{ marginBottom: "0.45rem" }}>
        <input
          type="number"
          min={1}
          value={offerAmount}
          onChange={(e) => setOfferAmount(Number(e.target.value) || 0)}
          className="amount-input"
          aria-label="Offer amount"
        />
        <button
          type="button"
          className="hud-button compact"
          onClick={() => {
            const result = postCashBorrowOffer(match, activeId, offerAmount);
            onMatchChange(result.state, result.ok ? result.note : result.reason);
          }}
        >
          Offer
        </button>
      </div>

      <h4>Open offers — select amount</h4>
      <ul className="loan-list">
        {match.cashBorrowOffers.length === 0 && (
          <li>
            <span className="muted tiny">No open offers.</span>
          </li>
        )}
        {match.cashBorrowOffers.map((offer) => {
          const lender = match.players.find((p) => p.id === offer.lenderId);
          const isMine = offer.lenderId === activeId;
          return (
            <li key={offer.id}>
              <div>
                <strong>
                  {lender?.displayName ?? offer.lenderId}: {offer.principalRemaining}
                </strong>
                <div className="muted tiny">Offer {offer.id}</div>
              </div>
              {!isMine && (
                <span className="hand-actions">
                  <input
                    type="number"
                    min={1}
                    max={offer.principalRemaining}
                    value={Math.min(takeAmount, offer.principalRemaining)}
                    onChange={(e) => setTakeAmount(Number(e.target.value) || 0)}
                    className="amount-input"
                    aria-label="Take amount"
                  />
                  <button
                    type="button"
                    className="hud-button compact"
                    disabled={cap.used >= cap.max}
                    onClick={() => {
                      const result = acceptCashBorrowOffer(
                        match,
                        activeId,
                        offer.id,
                        Math.min(takeAmount, offer.principalRemaining),
                      );
                      onMatchChange(
                        result.state,
                        result.ok ? result.note : result.reason,
                      );
                    }}
                  >
                    Take +{cap.defaultRate}%
                  </button>
                  {cap.lowerRate != null && (
                    <button
                      type="button"
                      className="hud-button compact ghost"
                      disabled={cap.used >= cap.max}
                      title={`Pay ${cap.lowerRateUnlockFeePct * 100}% of amount for +${cap.lowerRate}%`}
                      onClick={() => {
                        const result = acceptCashBorrowOffer(
                          match,
                          activeId,
                          offer.id,
                          Math.min(takeAmount, offer.principalRemaining),
                          match.turnIndex + 4,
                          { unlockLowerRate: true },
                        );
                        onMatchChange(
                          result.state,
                          result.ok ? result.note : result.reason,
                        );
                      }}
                    >
                      Pay→+{cap.lowerRate}%
                    </button>
                  )}
                </span>
              )}
            </li>
          );
        })}
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

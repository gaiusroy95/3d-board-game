# Back in century 20

Steam-targeted four-player desktop board game (**Back in century 20**). **Milestone 2** delivers local core gameplay (economy, decks, figurines, win/lose, bank loans) on top of the Milestone 1 table/boards prototype.

## Milestone 2 features

- Starting cash **1000** / lives **3** (documented ASSUMPTIONS until client locks values)
- **Bank** five actions: create · setup money · pay build cost · receive payment · return by level
- **Build** pays cost table immediately into Bank; blocked if insufficient cash
- **End turn:** figurine having reward → **Normal + Extra** calculating-rate returns → player+level advance together
- Opponent-board builds gated by permit card / condition flag; Extra payout to builder
- Shared special **decks 1–3** (40/45/45, prices 4000/6000/8000), buy / play ≤4 / unlock / recycle 0.3×
- Placeholder card catalog (swap when client list arrives); Deck1 card 1 = opponent-build permit
- Figurine learn / activate with configurable cash costs & rewards
- Win/lose evaluation: 0 lives, cash ≤ −7000, 70 pts → final-options stub, 0 specials → special end
- Bank **loans** 5 buttons (repay premiums 0/25/50/75/100%; OPEN terms zeroed)

## Prerequisites

- Node.js 20+
- npm 10+
- Windows 10/11 recommended for the Electron desktop shell

## Commands

```bash
npm install
npm run dev          # Electron + Vite
npm run dev:web      # browser only
npm test
npm run typecheck
npm run build
npm run dist         # Windows unpackaged Electron output
```

## Project layout

```
src/domain/      Pure rules: bank, payouts, cards, figurines, loans, win/lose, match
src/render/      Three.js table, boards, figurines
src/app/         React HUD, CardPanel, LoanPanel
src/desktop/     Electron main/preload
tests/           Vitest unit tests
```

## Assumptions

Temporary coding defaults (not client-approved facts) live in `src/domain/assumptions.ts` and `../dev-brief/docs/M2_ASSUMPTIONS.md`.

## Out of scope (later milestones)

Steam networking, online sync, full tournament admin product, final art, inventing missing card effects or limit-scheme percentages.

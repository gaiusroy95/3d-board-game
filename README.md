# Four Player Board

Milestone 1 local prototype of a four-player desktop board game intended for Steam.

## Features in this milestone

- Dark tabletop with a white skull centerpiece
- Four separate 5×5 player boards
- Columns: Wine, Rum, Tequila, Vodka, Whisky
- Levels 1–5 (Level 1 at the bottom)
- Level-turn flow with End turn
- Scoring foundation: Level 5 = 5 points; Levels 1–4 = 0
- Figurine slots (up to 7) with activation popup (figurines are activated, not moved)
- Build / Destroy controls as placeholders until remaining rules are confirmed
- Tournament bracket helpers for later work (64 → 16 → 4 → 1)

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

First Electron launch downloads a platform binary into `node_modules/electron/dist` (may take several minutes).

## Demo assets

Screenshots and a short demo video are in `demo/`.

## Project layout

```
src/domain/      Game rules and tournament helpers (pure TypeScript)
src/render/      Three.js table, boards, figurines
src/app/         React HUD and UI state
src/desktop/     Electron main/preload
src/interfaces/  Future multiplayer / admin service contracts
tests/           Unit tests
demo/            Milestone 1 screenshots and demo video
```

## Notes

Steam networking, online multiplayer, and full tournament administration are out of scope for Milestone 1. Build/money mutations and figurine skill costs remain pending confirmed design details.

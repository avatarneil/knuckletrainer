---
date: 2026-05-15
source: ../brainstorms/2026-05-15-mobile-training-accessibility-requirements.md
status: completed
---

# Mobile Training and Accessibility Pass Plan

## Visual Thesis

Extend the existing compact game UI with a small training tray that feels like part of the board controls, not a separate coaching dashboard.

## Content Plan

1. Keep the board as the primary surface.
2. Show mobile training analysis below the board in a compact summary.
3. Let learners expand the tray for per-column probabilities, score gain, and removal detail.
4. Preserve the existing desktop side analysis panel.
5. Align home, metadata, and PWA copy with the configured difficulty list.

## Interaction Plan

1. Compact tray opens and closes with an obvious button.
2. Best moves use icon/text/rank cues in addition to accent color.
3. Roll, turn, game-over, and analysis-ready updates flow through an `aria-live` status region.

## Implementation Units

- U1: Mobile training tray
  - Files: `src/app/play/page.tsx`, `src/components/training/WinProbability.tsx`
  - Covers: R1, R2, R3
  - Verification: Phone portrait shows compact analysis during player placing phase, expansion shows full details, and legal columns remain visible.

- U2: Accessible board controls
  - Files: `src/components/game/GameBoard.tsx`, `src/components/game/PlayerGrid.tsx`, `src/components/game/Column.tsx`, `src/components/game/DiceRoller.tsx`, `src/app/globals.css`
  - Covers: R4, R5, R6, R7
  - Verification: Column controls expose player, column, score, legal/disabled state, and recommendation status; recommended moves have non-color cues; focus rings and touch targets remain usable.

- U3: State announcements
  - Files: `src/app/play/page.tsx`
  - Covers: R6
  - Verification: Live status changes after roll, turn change, game over, and analysis availability.

- U4: Difficulty copy consistency
  - Files: `src/app/page.tsx`, `src/app/layout.tsx`, `public/manifest.json`
  - Covers: R8
  - Verification: User-facing copy derives from or matches the eight configured difficulties.

## Test Plan

- Run `npm run lint`.
- Run `npx tsc --noEmit`.
- Run a Next dev server and smoke test `/play?difficulty=medium&training=true` at mobile and desktop sizes.

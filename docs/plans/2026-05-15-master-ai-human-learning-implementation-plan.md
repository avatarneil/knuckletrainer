---
date: 2026-05-15
topic: master-ai-human-learning
source: ../brainstorms/2026-05-15-master-ai-human-learning-requirements.md
status: completed
---

# Master AI Human Learning Implementation Plan

## Scope

Ship the first Play vs AI implementation of Master learning from human moves. The feature records learner moves against Master, exposes a plain-language profile in the play UI, and gives the learner a reset control.

The current Master profile is backed by the local WASM runtime state. This pass will present the learning scope as local to the current app run, avoiding claims of account, cloud, cross-device, or durable reload persistence.

## Implementation Units

### U1. Record Human Moves Against Master

- **Goal:** When a learner places a die in Play vs AI against Master, record the move before applying it.
- **Files:** `src/hooks/useGame.ts`
- **Approach:** Detect `options.mode === "ai"`, `difficulty === "master"`, `currentPlayer === "player1"`, and a non-null current die. Call `recordOpponentMoveForLearning` with the pre-move state, selected column, die value, opponent player `player1`, and Master player `player2`.
- **Verification:** Human moves in other difficulties do not record. Master receives end-of-game profile completion when the game ends.

### U2. Expose A Readable Master Profile

- **Goal:** Show whether Master is still learning, adapting, or unavailable, with learner-readable tendencies.
- **Files:** `src/app/play/page.tsx`, optional component under `src/components/training/`
- **Approach:** Read `getMasterProfileStats("player2")` and `isMasterReady("player2")` while the selected difficulty is Master. Summarize strongest column preference and attack tendency using plain text. Avoid raw model details.
- **Verification:** The settings or game-over UI shows total evidence, profile readiness, column preference, and attack tendency.

### U3. Reset Learned Profile

- **Goal:** Let the learner clear the Master profile from the Play UI.
- **Files:** `src/app/play/page.tsx`, optional component under `src/components/training/`
- **Approach:** Add a reset action that calls `resetMasterProfile("player2")` and refreshes the displayed profile state.
- **Verification:** After reset, stats return to unlearned defaults and the UI reflects the reset.

## Test Plan

- Run TypeScript validation with `npx tsc --noEmit`.
- Run the project linter with `npm run lint`.
- Run the production build path if available in the local environment.
- Exercise the code path by checking that the implementation records from the pre-move state and only when the opponent difficulty is Master.

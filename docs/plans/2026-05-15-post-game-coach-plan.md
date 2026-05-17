---
date: 2026-05-15
status: completed
origin: docs/brainstorms/2026-05-15-post-game-coach-requirements.md
---

# Post-Game Coach Implementation Plan

## Problem Frame

The AI game-over moment should become a compact coaching review: one clear lesson when a meaningful human decision exists, practical retry/inspect actions, and locally saved metadata for later review. The first version stays moment-based and local-only, following the source requirements in `docs/brainstorms/2026-05-15-post-game-coach-requirements.md`.

## Scope Boundaries

- Build this for single-player AI games only.
- Keep the game-over dialog compact; avoid replay dashboards or long-form tutoring.
- Store only local history metadata, capped by the existing history limit.
- Fall back to the existing simple result when analysis cannot produce a meaningful lesson.

## Decisions

- Analyze at game end by replaying the completed move history from the initial state. This avoids blocking normal turns and keeps existing gameplay state semantics intact.
- Store only the strongest coach moment in v1, including the pre-move state needed to inspect or retry that decision. This satisfies recent-review practicality without growing history into full replay storage.
- Implement retry as an in-page one-move exercise over the saved pre-move state, separate from the completed game session. This lets the learner practice the decision without mutating saved history or current game state.

## Implementation Units

### U1: Coach Analysis Model

Goal: Produce a compact post-game coach brief from a completed AI game.

Files:
- Create: `src/engine/post-game-coach.ts`
- Modify: `src/engine/index.ts`
- Test target: `npm run lint` and `npx tsc --noEmit`

Approach:
- Replay `GameState.moveHistory` with `rollSpecificDie` and `applyMove` to reconstruct each decision point.
- Analyze player-one placing states with existing `quickAnalysis`.
- Select the highest-impact missed decision using win probability delta, expected score delta, and missed dice removal.
- Return `null` when the game is not eligible or no meaningful moment exists.

Test Scenarios:
- AI game with a weaker human move produces a moment with chosen and recommended columns.
- Non-ended, multiplayer, or unanalyzable games return no brief.
- The returned moment includes the pre-move state for inspection and retry.

### U2: Persist Coach Metadata

Goal: Preserve the coach brief in completed local history.

Files:
- Modify: `src/lib/game-storage.ts`
- Modify: `src/hooks/useGameHistory.ts`
- Test target: `npm run lint` and `npx tsc --noEmit`

Approach:
- Add an optional `coach` field to `GameHistoryEntry`.
- Let `recordGameEnd` accept optional coach metadata and write it with the completed entry.
- Preserve the existing 50-entry storage cap.

Test Scenarios:
- Completed AI games can store coach metadata.
- Existing history entries without coach metadata remain valid.

### U3: Game-Over Coach UI

Goal: Show the coach brief and actions in the AI game-over dialog.

Files:
- Modify: `src/app/play/page.tsx`
- Modify: `src/hooks/useGame.ts`
- Test target: `npm run lint`, `npx tsc --noEmit`, and local browser smoke test if the app builds.

Approach:
- Pass final `GameState` through `useGame`'s end-game callback so history and analysis use the true terminal state.
- Build a compact summary showing final score, difficulty, turn count, training mode, chosen move, and recommended move.
- Keep existing View Board and Play Again actions available.

Test Scenarios:
- A completed AI game with a coachable moment shows the coach summary.
- A completed AI game without analysis still shows the current simple result and Play Again.
- Final score, difficulty, turn count, and training mode appear when a brief exists.

### U4: Inspect and Retry Moment

Goal: Let the learner inspect the highlighted moment and retry it as a one-move exercise.

Files:
- Modify: `src/app/play/page.tsx`
- Test target: `npm run lint`, `npx tsc --noEmit`, and local browser smoke test if the app builds.

Approach:
- Add a review banner above the board when inspecting or retrying.
- Render the stored pre-move state on the board, highlighting the recommended column and showing move probabilities.
- For retry mode, let the learner choose one legal column, then reveal whether it matched the recommended move.

Test Scenarios:
- Inspect closes the dialog and restores the saved decision point visually.
- Retry lets the learner choose a column once and reveals the recommended move.
- Exiting review returns to the final completed board without starting a new game.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build:wasm:check`
- `npm run build` if WASM tooling is available

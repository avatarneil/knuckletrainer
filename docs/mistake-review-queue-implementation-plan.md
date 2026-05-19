# Mistake Review Queue Implementation Plan

## Source Brief

- `docs/brainstorms/2026-05-15-mistake-review-queue-requirements.md`

## Planning Decisions

- Capture threshold: store a candidate when the best analyzed move beats the chosen move by at least 12 percentage points of win probability, or by at least 8 expected score points. This keeps low-gap decisions out of the queue while still catching tactical misses.
- Analysis fallback: use the current training analysis when it exists; otherwise run quick analysis at placement time inside a guarded best-effort path so normal play is never blocked by review capture failure.
- Reason labels: derive a first-version reason from existing analysis fields and board context: missed removal, missed stack, poor defense, low-value trap, or stronger expected outcome.
- Persistence: use the existing local storage adapter boundary so queue data remains device-local and account-free.

## Implementation Units

1. Add review queue domain helpers and storage APIs.
2. Capture human AI-game placements as review items before applying the move.
3. Add a review queue route with drill feedback, progress updates, delete, and clear controls.
4. Link the queue from the home and play surfaces.
5. Verify with type checks, linting, formatting, and production build.

## Acceptance Mapping

- AE1: capture helper stores the pre-move state, legal columns, chosen column, best column, and gap metrics.
- AE2: review route asks for a column, then reveals chosen move, best move, and reason text.
- AE3: review storage is local-only and exposes individual delete plus full clear actions.

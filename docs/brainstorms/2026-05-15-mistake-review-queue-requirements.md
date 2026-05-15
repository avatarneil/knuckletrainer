---
date: 2026-05-15
topic: mistake-review-queue
---

# Mistake Review Queue

## Summary

Add a review queue that turns missed or low-quality moves into repeatable training drills. The feature should make a finished game produce concrete next practice instead of leaving win probability analysis as a temporary in-game overlay.

---

## Problem Frame

KnuckleTrainer already exposes move analysis during play and records completed games locally, but those two pieces do not yet compound into a learning loop. A learner can see probabilities while making a move, and later see aggregate history, but the app does not preserve the moments where a better decision was available.

This matters because Knucklebones skill improves through pattern recognition: when to attack, when to stack, when to block, and when a tempting immediate score is actually weaker than a defensive move. Without review, the learner has to remember those positions manually.

---

## Actors

- A1. Learner: Plays against AI and wants short, concrete practice after mistakes.
- A2. Analysis engine: Scores legal moves and identifies better alternatives.
- A3. Local progress store: Keeps review items and practice progress on the device.

---

## Key Flows

- F1. Capture a review item
  - **Trigger:** A learner makes a move in a game where analysis is available.
  - **Actors:** A1, A2, A3
  - **Steps:** The app compares the chosen column to the strongest analyzed move, measures the gap, stores the pre-move position when the gap is meaningful, and tags the item with a reason category.
  - **Outcome:** A concrete mistake or near-miss is available for later practice.
  - **Covered by:** R1, R2, R3

- F2. Practice a saved position
  - **Trigger:** The learner opens the review queue and starts a drill.
  - **Actors:** A1, A2, A3
  - **Steps:** The app restores the original position, asks the learner to choose a column, reveals the best move and result after the answer, and updates queue progress.
  - **Outcome:** The learner rehearses the exact decision pattern rather than reading a generic tip.
  - **Covered by:** R4, R5, R6

---

## Requirements

**Capture**
- R1. The app must capture review candidates from human placement decisions when move analysis is available.
- R2. Each review candidate must include enough game state to recreate the decision point, including current die, current player, both grids, legal columns, the chosen column, and the analyzed best column.
- R3. The app must assign a severity or priority using the gap between the chosen move and the best analyzed move, with low-gap decisions excluded by default.

**Review experience**
- R4. The review queue must present saved positions as short drills that can be completed independently of a full game.
- R5. A drill must reveal feedback only after the learner chooses, including the chosen move, the best move, and the practical reason the best move mattered.
- R6. The queue must prioritize unresolved and repeatedly missed patterns ahead of already-mastered positions.

**Persistence and control**
- R7. Review items and progress must be local-only by default.
- R8. The learner must be able to delete individual review items and clear the queue.
- R9. The feature must work even when deep analysis is unavailable by gracefully falling back to quicker or lower-confidence analysis.

---

## Acceptance Examples

- AE1. **Covers R1, R2, R3.** Given a learner chooses column 1 and analysis ranked column 3 significantly higher, when the move is applied, the app stores the pre-move position as a review item.
- AE2. **Covers R4, R5.** Given a saved review item, when the learner opens it and chooses a column, the app reveals whether that choice matched the best analyzed move and why the best move improved the position.
- AE3. **Covers R7, R8.** Given review items exist on a device, when the learner clears the queue, those items are removed without requiring an account or network request.

---

## Success Criteria

- Learners can finish a game and immediately see at least one useful practice item when they made a meaningful mistake.
- A downstream planner can build the feature without inventing the capture threshold, review flow, feedback timing, or persistence boundary.
- The feature increases repeat session value: the app gives the learner something specific to practice beyond starting another full game.

---

## Scope Boundaries

- Do not add account sync in the first version.
- Do not require a new AI engine; use existing analysis capability unless planning proves it insufficient.
- Do not create a general puzzle marketplace or social sharing surface.
- Do not block normal play if review capture fails.

---

## Key Decisions

- Capture mistakes from real games first, not from generated puzzles. Real mistakes are more personal and give the queue immediate relevance.
- Keep review local by default. The feature is useful without identity, server storage, or privacy questions.
- Prioritize short drills over long reports. The product should feel like a trainer, not a spreadsheet of regrets.

---

## Dependencies / Assumptions

- Existing game state and move analysis are sufficient to recreate a pre-move decision point.
- Planning should validate whether analysis can run cheaply enough after each human placement, or whether capture should happen only in training mode or at game end.
- Reason categories can start simple, such as missed removal, missed stack, poor defense, or low immediate-value trap.

---

## Outstanding Questions

### Deferred to Planning

- [Affects R1, R3][Technical] What threshold should define a meaningful mistake without filling the queue with noise?
- [Affects R5][Technical] Can the current analysis data support useful reason labels, or does the planner need to derive reason categories from board deltas?

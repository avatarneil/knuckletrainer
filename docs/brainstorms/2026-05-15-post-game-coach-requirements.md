---
date: 2026-05-15
topic: post-game-coach
---

# Post-Game Coach

## Summary

Expand the game-over moment into a compact coaching review. The feature should explain the most important turning points, offer replay or retry actions, and save enough context for later learning.

---

## Problem Frame

The current game-over experience records the result and lets the learner view the board or play again. That is clean, but it misses the highest-attention learning moment: the learner has just won or lost and is ready to understand why.

KnuckleTrainer already has move history, local game history, move analysis, and simulation replay concepts. A post-game coach can connect those ingredients into a training product that gives the learner a useful takeaway after each match.

---

## Actors

- A1. Learner: Wants to understand why a game was won or lost.
- A2. Analysis engine: Identifies important decisions and stronger alternatives.
- A3. Game history: Stores completed game summaries for later review.

---

## Key Flows

- F1. See a coaching summary
  - **Trigger:** A game against AI ends.
  - **Actors:** A1, A2, A3
  - **Steps:** The app records the result, analyzes key human decisions, and presents a short summary in or near the game-over dialog.
  - **Outcome:** The learner leaves the match with one or more concrete lessons.
  - **Covered by:** R1, R2, R3

- F2. Retry a turning point
  - **Trigger:** The learner selects a highlighted moment from the coach.
  - **Actors:** A1, A2
  - **Steps:** The app restores the relevant pre-move position, lets the learner choose again, and reveals the stronger move.
  - **Outcome:** The learner can immediately practice the decision that mattered.
  - **Covered by:** R4, R5

---

## Requirements

**Game-over summary**
- R1. The game-over experience must include an optional coaching summary for AI games when enough analysis is available.
- R2. The summary must identify at least one high-impact moment, such as the largest missed win-probability gain, biggest score swing, or missed dice removal.
- R3. The summary must include final score, difficulty, turn count, and whether training mode was enabled.

**Review actions**
- R4. The learner must be able to inspect a highlighted moment from the final summary.
- R5. The learner must be able to retry a highlighted position as a one-move training exercise.
- R6. The learner must still be able to dismiss the coach and immediately play again.

**Saved history**
- R7. Completed game history must preserve enough coaching metadata to reopen recent reviews when practical.
- R8. If analysis is unavailable, the game-over dialog must fall back to the current simple result without blocking the player.

---

## Acceptance Examples

- AE1. **Covers R1, R2, R3.** Given a learner loses an AI game and made a clearly weaker move, when the game ends, the coach names that moment and shows the stronger move.
- AE2. **Covers R4, R5.** Given a highlighted missed move, when the learner chooses retry, the app restores that decision point and asks for a new column choice.
- AE3. **Covers R6, R8.** Given analysis cannot complete, when the game ends, the learner still sees the ordinary result and can start another game.

---

## Success Criteria

- A completed match reliably produces one clear lesson when a meaningful lesson exists.
- The game-over moment drives at least one next action: retry a position, add to review queue, or start another game with a concrete focus.
- A downstream planner can distinguish post-game coaching from full replay, puzzle generation, and general stats dashboards.

---

## Scope Boundaries

- Do not require full natural-language tutoring in the first version.
- Do not turn the game-over dialog into a long report; the first screen should stay compact.
- Do not require account storage or server-side history.
- Do not analyze multiplayer games in v1 unless planning finds it nearly free and privacy-safe.

---

## Key Decisions

- Put coaching at game over first. That is the moment of highest motivation and lowest navigation friction.
- Keep the first version moment-based rather than dashboard-based. One useful lesson beats ten undigested metrics.
- Treat retry as the primary action. The best proof that the coach worked is the learner making the better move.

---

## Dependencies / Assumptions

- Move history contains enough information to reconstruct decision points, or planning can extend saved history without changing core gameplay semantics.
- Existing analysis can evaluate past decision points at game end without harming perceived responsiveness.
- The mistake review queue brief can share concepts with this feature, but the post-game coach must remain useful even if the queue is not built yet.

---

## Outstanding Questions

### Deferred to Planning

- [Affects R2][Technical] Should analysis run incrementally during play or batch at game end?
- [Affects R7][Technical] How much coaching metadata can be stored locally before history needs pruning beyond the existing limit?

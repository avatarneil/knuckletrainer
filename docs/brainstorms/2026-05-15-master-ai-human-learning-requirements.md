---
date: 2026-05-15
topic: master-ai-human-learning
---

# Master AI Human Learning

## Summary

Make the Master AI learn from human play in regular Play vs AI games, then expose that learning as a readable profile. The goal is for "Master" to feel adaptive to the learner, not only adaptive inside simulation mode.

---

## Problem Frame

The codebase already defines Master as the difficulty that "learns opponent patterns and adapts strategy" and simulation mode records opponent moves for Master learning. In regular human-vs-AI play, the current flow should be verified during planning, but the reviewed play path did not show the same explicit learning call when the human places a die.

This creates a product credibility gap: the most interesting AI personality may not visibly learn from the person using the trainer. If the app can make Master adapt across the learner's own games, it gains a memorable training loop and a reason to keep playing beyond raw difficulty.

---

## Actors

- A1. Learner: Plays against Master and expects the opponent to adapt.
- A2. Master AI: Maintains a profile of opponent tendencies and uses it during move selection.
- A3. Trainer UI: Explains what Master has learned and gives the learner control over reset/privacy.

---

## Key Flows

- F1. Learn from a human move
  - **Trigger:** The learner places a die during a game against Master.
  - **Actors:** A1, A2
  - **Steps:** The app records the move from the pre-move state, updates the Master profile, and continues play without interrupting the turn.
  - **Outcome:** Master has more evidence about the learner's habits.
  - **Covered by:** R1, R2, R3

- F2. Show the learned profile
  - **Trigger:** The learner opens settings, game over, or a Master status panel.
  - **Actors:** A1, A3
  - **Steps:** The UI summarizes learned tendencies, explains whether adaptation is active, and offers reset.
  - **Outcome:** The learner understands that Master is reacting to their style.
  - **Covered by:** R4, R5, R6

---

## Requirements

**Learning behavior**
- R1. Human moves in Play vs AI must be recorded for Master learning when the active opponent difficulty is Master.
- R2. Learning must use the board state before the human move is applied so removal and score-loss patterns can be measured accurately.
- R3. Learning must not run for non-Master difficulties unless the learner explicitly chooses a mode that uses adaptive profiling.

**Learner-facing profile**
- R4. The UI must show whether Master has enough evidence to adapt or is still learning.
- R5. The profile must summarize at least column preference and attack tendency in learner-readable language.
- R6. The learner must be able to reset the learned Master profile.

**Trust and resilience**
- R7. Master learning must degrade gracefully if WASM or profile storage is unavailable.
- R8. The app must avoid implying long-term learning until the profile actually persists across the relevant scope.
- R9. The feature must keep learning local unless a future account-based sync feature explicitly changes that boundary.

---

## Acceptance Examples

- AE1. **Covers R1, R2.** Given the learner is playing against Master and places a die that removes opponent dice, when the move is applied, Master records that move using the pre-move board.
- AE2. **Covers R4, R5.** Given Master has observed enough moves, when the learner opens the Master profile, the UI shows a plain-language summary such as a favored column or attack tendency.
- AE3. **Covers R6.** Given a learned profile exists, when the learner resets it, Master returns to an unlearned state and the UI reflects that reset.
- AE4. **Covers R7, R8.** Given profile learning is unavailable, when the learner selects Master, the app still plays a strong fallback game without falsely presenting active adaptation.

---

## Success Criteria

- A learner can play multiple games against Master and see evidence that Master is learning their style.
- The Master difficulty feels meaningfully distinct from Expert rather than only stronger or differently named.
- A downstream planner can identify where human-move recording, profile status, reset, and fallback behavior belong without inventing product semantics.

---

## Scope Boundaries

- Do not build cloud profiles or cross-device learning in the first version.
- Do not expose raw model internals; summaries should be understandable to a normal player.
- Do not make Master unbeatable solely because it adapts; the feature should teach and challenge, not punish.
- Do not change the meaning of Grandmaster; this brief concerns Master only.

---

## Key Decisions

- Treat human play as the primary learning surface. Simulation learning is useful, but a trainer becomes compelling when it learns the actual learner.
- Make adaptation visible. Invisible learning risks feeling indistinguishable from ordinary difficulty tuning.
- Include reset from the start. Adaptive opponents need a clear escape hatch when the learner wants a clean slate.

---

## Dependencies / Assumptions

- The existing Master profile API can record opponent moves from the regular play flow.
- Planning should verify whether the current profile survives page reloads, app restarts, and native shell restarts; the UI language should match the actual persistence scope.
- Planning should confirm whether Master appears in all intended difficulty selectors and whether any copy still understates the number of difficulties.

---

## Outstanding Questions

### Deferred to Planning

- [Affects R8][Technical] What is the actual persistence lifetime of the Master profile today?
- [Affects R4, R5][Technical] Where should the Master profile appear so it is visible without cluttering the main game board?

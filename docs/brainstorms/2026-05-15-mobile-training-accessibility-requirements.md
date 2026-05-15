---
date: 2026-05-15
topic: mobile-training-accessibility
---

# Mobile Training and Accessibility Pass

## Summary

Make training mode usable on small screens and improve accessibility for the core board controls. The feature should preserve the compact game layout while ensuring analysis, column choices, state changes, and difficulty copy are understandable without relying on desktop-only panels or color alone.

---

## Problem Frame

KnuckleTrainer is already shaped for responsive play, PWA install, and native shells, but the training experience is not equally visible across viewport sizes. The detailed move-analysis panel is desktop-only, and core column controls are visually clear but need stronger accessible names and non-color cues.

This matters because training value should survive the most likely casual usage contexts: phone portrait, phone landscape, touch input, keyboard input, and screen readers. A polished mobile trainer should not ask learners to choose between good layout and good feedback.

---

## Actors

- A1. Mobile learner: Plays on a phone or installed app and needs analysis without leaving the board.
- A2. Keyboard learner: Uses shortcuts or non-pointer controls.
- A3. Screen reader user: Needs game state and legal actions communicated semantically.
- A4. Sighted learner with color limitations: Needs best-move and probability cues beyond color.

---

## Key Flows

- F1. Use training analysis on mobile
  - **Trigger:** A mobile learner enables training mode and rolls a die.
  - **Actors:** A1
  - **Steps:** The app shows concise move guidance near the board, lets the learner expand details, and keeps touch targets reachable.
  - **Outcome:** Training mode is useful without desktop layout.
  - **Covered by:** R1, R2, R3

- F2. Navigate the board accessibly
  - **Trigger:** A learner interacts with columns using assistive tech, keyboard, or touch.
  - **Actors:** A2, A3, A4
  - **Steps:** The app exposes meaningful labels, announces state changes, and provides non-color indicators for recommended moves.
  - **Outcome:** The learner can understand and act on the game state through multiple input and perception modes.
  - **Covered by:** R4, R5, R6, R7

---

## Requirements

**Mobile training**
- R1. Training mode must expose move analysis on mobile viewports, not only desktop.
- R2. Mobile analysis must have a compact default state and an expanded detail state.
- R3. Mobile analysis must not cover the board in a way that prevents placing a die or reading current scores.

**Accessible controls and feedback**
- R4. Each playable column control must have an accessible name that includes player, column number, score, legal/disabled state, and current training recommendation when available.
- R5. Best-move and warning states must use a non-color cue in addition to color.
- R6. Important state changes must be announced or exposed semantically, including die roll result, turn change, game over, and analysis ready.
- R7. Touch targets and keyboard shortcuts must remain usable in portrait, landscape, and desktop layouts.

**Copy and consistency**
- R8. Difficulty copy must match the configured difficulty set.
- R9. Accessibility improvements must not remove the existing fast-play feel or visual polish.

---

## Acceptance Examples

- AE1. **Covers R1, R2, R3.** Given training mode is enabled on a phone, when the learner enters placing phase, compact analysis appears and can expand without hiding all legal column controls.
- AE2. **Covers R4.** Given a screen reader focuses a legal column, when analysis is available, the label communicates the column number, score, and whether it is the recommended move.
- AE3. **Covers R5.** Given color contrast or color perception makes green/yellow/red unreliable, when a best move is shown, the learner can still identify it through text, icon, shape, or ordering.
- AE4. **Covers R6.** Given a die roll completes, when the current die changes from empty to a value, assistive tech can perceive the new value.
- AE5. **Covers R8.** Given the configured difficulty list changes, when the home page and metadata describe difficulties, the copy does not contradict the actual set.

---

## Success Criteria

- Training mode is usable and understandable on phone portrait without needing desktop-only UI.
- Core gameplay controls pass a manual accessibility smoke test for names, focus, state changes, and color-independent meaning.
- A downstream planner can separate layout work, semantic control work, and copy consistency without inventing user outcomes.

---

## Scope Boundaries

- Do not redesign the whole visual identity.
- Do not replace the existing keyboard shortcut feature; improve compatibility with it.
- Do not promise full WCAG certification in this brief; target practical gameplay accessibility improvements first.
- Do not make the mobile analysis panel so rich that it competes with the board as the primary surface.

---

## Key Decisions

- Treat mobile training as core product behavior, not responsive polish. Training is in the product promise and should work where learners actually play.
- Use progressive disclosure for analysis. Compact guidance protects the board; expansion preserves detail.
- Fix copy consistency as part of trust. Difficulty descriptions should not contradict the configured game.

---

## Dependencies / Assumptions

- Existing board layout constraints can support a bottom sheet, tray, or inline compact analysis surface without changing the rules UI.
- Planning should audit current metadata, home page copy, and any app-store-facing copy separately if release packaging is in scope.
- Manual assistive-tech testing will be needed because static code review cannot fully verify screen reader behavior.

---

## Outstanding Questions

### Deferred to Planning

- [Affects R1, R2, R3][Design] Should mobile analysis appear as a bottom sheet, inline tray, or collapsible board-adjacent strip?
- [Affects R6][Technical] What is the lightest reliable announcement mechanism for roll, turn, and analysis state changes in the current React structure?

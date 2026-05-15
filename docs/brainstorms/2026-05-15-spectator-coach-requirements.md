---
date: 2026-05-15
topic: spectator-coach
---

# Spectator Coach

## Summary

Add an optional coaching layer to public match spectating. Spectators should be able to watch live games with lightweight analysis overlays and follow a player or AI match sequence into the next public game.

---

## Problem Frame

The watch surface already lists public rooms, opens live boards, shows watcher count, and includes a follow action. Today it is mainly passive: spectators can observe the board, but the product does not help them understand the position or reliably continue watching the next match.

Spectating can become a learning surface if the app explains why moves matter. This is especially valuable for KnuckleTrainer because the best move is often non-obvious: a lower immediate score can remove opponent dice, preserve a future stack, or block a dangerous column.

---

## Actors

- A1. Spectator: Watches a public match to learn or follow a player.
- A2. Public match player: Makes the match visible but should not be slowed down by spectator analysis.
- A3. Watch service: Publishes room state and watcher/follow metadata.
- A4. Analysis engine: Provides optional position insight for spectators.

---

## Key Flows

- F1. Watch with coach overlay
  - **Trigger:** A spectator opens a live public match.
  - **Actors:** A1, A3, A4
  - **Steps:** The spectator toggles coaching on, sees legal-move analysis during placing phases, and can turn it off at any time.
  - **Outcome:** The spectator learns from the live position without interacting with the match.
  - **Covered by:** R1, R2, R3, R4

- F2. Follow the next match
  - **Trigger:** A spectator follows a public match or player and the current match ends.
  - **Actors:** A1, A3
  - **Steps:** The app remembers the follow intent, detects a successor public match when available, and offers or performs navigation based on the chosen behavior.
  - **Outcome:** Spectators can keep watching a sequence instead of returning to the lobby manually.
  - **Covered by:** R5, R6, R7

---

## Requirements

**Coaching overlay**
- R1. Spectator analysis must be optional and off by default.
- R2. When enabled during a placing phase, the overlay must show legal candidate moves and a clear best-move marker.
- R3. The overlay must include a concise explanation after a move is made, such as removal, stack value, defensive block, or score swing.
- R4. Spectator coaching must never allow the spectator to roll, place, or otherwise affect the match.

**Follow behavior**
- R5. The follow action must have an observable outcome that persists after the current room ends.
- R6. When a followed player or AI match starts a successor public game, the spectator must be offered a clear path to continue watching.
- R7. The watch lobby must make followed or recently watched matches easy to find when automatic continuation is not possible.

**Performance and safety**
- R8. Analysis work must be rate-limited or cached so multiple spectators do not create avoidable load.
- R9. Public match privacy must remain explicit; private rooms must not become discoverable through spectator features.

---

## Acceptance Examples

- AE1. **Covers R1, R2, R4.** Given a spectator opens a public match, when coaching is off, the board remains passive; when coaching is enabled, move guidance appears but board controls remain non-interactive.
- AE2. **Covers R3.** Given a player places a die that removes two opponent dice, when the spectator overlay updates, it explains the removal impact in plain language.
- AE3. **Covers R5, R6.** Given a spectator follows a public AI match, when that match ends and the player starts another public match, the spectator is offered a continuation path.
- AE4. **Covers R8.** Given several spectators watch the same room, when coaching is enabled by multiple people, the system avoids recomputing identical analysis per spectator whenever feasible.

---

## Success Criteria

- Spectators can learn from a live match without needing to already understand optimal play.
- The existing follow control becomes meaningful and testable.
- Public watch remains lightweight enough that players do not experience slower turns because spectators are present.

---

## Scope Boundaries

- Do not add spectator chat in the first version.
- Do not expose private matches in public discovery.
- Do not require accounts or social graphs.
- Do not make coaching mandatory; some spectators may prefer a clean board.
- Do not optimize for large-scale streaming audiences until usage justifies it.

---

## Key Decisions

- Keep coach overlay opt-in. Spectating should remain simple and spoiler-free by default.
- Treat follow-through as part of the feature, not polish. A follow button with no visible continuation undermines trust.
- Prefer lightweight explanations over full engine lines. Spectators need to understand the move, not audit the search.

---

## Dependencies / Assumptions

- The current public room model can be extended to represent successor matches or followed identities without introducing accounts.
- Planning should verify whether follow state is currently local-only, server-side, or both, and align requirements with the actual room lifecycle.
- Analysis should run from public board state only; no hidden player information should be required.

---

## Outstanding Questions

### Deferred to Planning

- [Affects R5, R6][Technical] What stable identifier should define "follow this player or match sequence" without accounts?
- [Affects R8][Technical] Should spectator analysis run client-side, server-side, or from a cached room-level analysis snapshot?

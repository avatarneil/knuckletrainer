---
date: 2026-05-15
topic: spectator-coach
status: completed
source: ../brainstorms/2026-05-15-spectator-coach-requirements.md
---

# Spectator Coach Implementation Plan

## Decisions

- Use a stable browser-level spectator token for follow state. This avoids accounts while letting successor public rooms recognize the same spectator.
- Treat AI public rematches as explicit room lineage. New AI public rooms can declare a `previousRoomId`; the server links the previous room to the successor and migrates followers.
- Run coaching analysis client-side from public room state. Cache analysis by board-state signature so polling and multiple enabled spectators do not create server load.
- Keep private-room discovery unchanged. Public room APIs continue to filter on `isPublic`.

## Implementation Units

### U1: Spectator Coach Overlay

Add an off-by-default coach toggle on `/watch/[id]`. When enabled during a placing phase, compute legal move analysis from public state, show candidate moves, highlight the best move on the board, and show a concise explanation for the most recent placement when available.

Verification: the watch board remains passive, coach UI is hidden by default, and placing-phase public states show legal candidates plus a best marker.

### U2: Follow Continuation

Persist follows through a browser spectator token and room lineage. Link AI successor rooms to the previous public room and expose a safe `successorRoomId` in public state so ended followed matches can offer a continue-watching path.

Verification: following a public room has visible state, ended followed rooms can show a continuation link once the successor exists, and private rooms remain excluded.

### U3: Watch Lobby Follow Affordances

Make `/watch` aware of the spectator token and local recent-watch records. Highlight followed successor rooms and recently watched matches so automatic continuation is not the only way back into a match sequence.

Verification: the lobby can badge followed/recent rooms without exposing watcher tokens.

### U4: Quality Checks

Run the project lint and TypeScript/build checks that are available in this repo, then fix any regressions found.

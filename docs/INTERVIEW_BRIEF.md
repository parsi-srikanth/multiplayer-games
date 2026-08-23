# Interview brief

## 30-second explanation

Parsi Games is a deployed mobile-first browser platform for solo and low-friction 2–4 player games. A React/Vite client and one Cloudflare Worker serve the application, while each multiplayer room is an isolated SQLite-backed Durable Object using Hibernation WebSockets. The server validates commands, owns game state and scoring, and sends viewer-specific projections so secrets never depend on UI hiding. Seven games are currently playable at <https://games.srikanthparsi.com>.

## Two-minute technical walkthrough

The Worker serves static assets and exposes health, room-creation, room-info, and WebSocket routes. Room codes deterministically map to one Durable Object, making that object the ordered authority for admission, host election, lifecycle transitions, commands, reconnects, scoring, and broadcasts. The object persists one bounded JSON snapshot in SQLite before broadcasting and schedules alarms for 30-minute reconnect expiry and 24-hour inactive-room deletion.

The protocol validates untrusted messages at runtime and rejects binary frames or UTF-8 payloads over 16 KiB before JSON parsing. Room creation and access use Cloudflare rate-limit bindings, sockets have per-client and per-room budgets, and unavailable capacity produces bounded `429`/`503` responses rather than accepting unpersisted state.

Games implement an authoritative definition with private state, bounded commands, deterministic transitions, scoring, and per-viewer projection. The browser imports only explicitly safe local-solo definitions; server-only Sudoku generation and hidden solutions stay out of browser bundles. The deployed checkpoint includes Cows & Bulls Player Challenge, Cows & Bulls Classic, Word Race, Tic-Tac-Toe+, Dots & Boxes, Connect Four, and Sudoku Sprint.

Verification includes 96 Node/jsdom tests, three Workers-runtime Durable Object tests, typecheck/lint/build/audit/Wrangler gates, a public two-client terminal-game/reconnect/host-transfer smoke, and public Chromium/Firefox/WebKit desktop and mobile-viewport checks.

## Five likely interview questions

### Why Durable Objects instead of stateless functions plus a database?

A room needs one ordered authority for concurrent commands and connected sockets. Deterministic Durable Object routing combines coordination, local SQLite persistence, and WebSocket ownership while unrelated rooms scale independently.

### How is hidden information protected?

Private game state is never broadcast and then filtered. Each game constructs an explicit projection for one viewer. Reconnect tokens are random, stored only as hashes, and server-only game definitions are kept outside browser imports.

### What happens when two commands race?

Both reach the same room object and execute against its current authoritative state in order. Illegal or stale-by-state actions are rejected without mutation; accepted state is persisted before acknowledgement and viewer-specific broadcast.

### How does reconnect and host transfer work?

A client receives a reconnect token once. The server stores its hash and permits identity recovery for 30 minutes. Permanent departure removes that player and deterministically elects the earliest connected participant as host. The public smoke verifies both reconnect identity and host transfer.

### What happens at free-tier limits?

New room/access operations are rate-limited and capacity errors return bounded `429` or `503` responses with solo guidance. Active state is bounded, idle sockets hibernate, and stale room storage is deleted. `$0/month` is conditional on traffic remaining within Cloudflare's free allowances, not a capacity guarantee.

## Key tradeoffs

1. **Cloudflare Worker + Durable Objects over ASP.NET/Azure hosting:** better zero-idle coordination economics for small public rooms, at the cost of learning Cloudflare-specific runtime and storage semantics.
2. **One compact snapshot over an event log:** simpler recovery and bounded reads/writes for an MVP, but less historical debugging and replay.
3. **No accounts or matchmaking:** much lower privacy and product complexity, but room links and reconnect tokens are the identity boundary.
4. **Server authority over optimistic client rules:** stronger integrity and convergence, at the cost of requiring a networked room for games such as Sudoku whose rules must stay server-only.

## What I would change at 10× scale

- Measure requests, CPU, Durable Object duration, and SQLite operations per completed game before changing architecture.
- Add abuse telemetry and account-level budget alarms.
- Introduce explicit command idempotency/revision preconditions if observed retries require them.
- Version stored game state and add migration/forward-fix tooling before incompatible game changes.
- Add regional synthetic probes and a larger physical-device lab rather than replacing the per-room authority prematurely.

## What I learned

- Hibernation reduces eligible idle duration but does not make requests, messages, alarms, or storage free.
- Durable Object alarms and synchronous request checks must work together because cleanup alarms are not a substitute for validating expiry at access time.
- Client/server import boundaries are security boundaries: a safe metadata manifest is insufficient if browser transport imports the full authoritative registry.
- Production evidence is strongest when the same bounded smoke is reusable locally, publicly, and after rollback.

## Verified evidence

- Live URL: <https://games.srikanthparsi.com>
- Public source: <https://github.com/parsi-srikanth/multiplayer-games>
- Production checkpoint merge: `ea9999971a295d89339dd6b7b81c3d2e856b2ca3`
- Checkpoint review and evidence: pull request #13
- Current deployed and rollback version IDs: recorded in [CHECKPOINT.md](CHECKPOINT.md)
- Testing, security, cost, deployment, and operations evidence: this repository's `docs/` directory

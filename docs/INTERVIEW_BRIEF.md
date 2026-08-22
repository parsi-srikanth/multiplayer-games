# Interview brief

## Thirty-second summary

Parsi Games is a production-oriented foundation for mobile-first solo and 2–4 player browser games. A single Cloudflare Worker serves a React/Vite SPA and routes each validated room to its own SQLite-backed Durable Object over Hibernation WebSockets. The server is authoritative, clients send intents, and per-viewer projections protect hidden state. The architecture targets the free tier and extensibility, but the current repository is a foundation: it does **not** yet ship ten games, complete room lifecycle, matchmaking, accounts, or a verified production deployment.

## What exists today

- Strict TypeScript boundaries for browser, Worker, tests, and tooling.
- Static asset/API routing and deterministic room sharding.
- A SQLite-backed room Durable Object with Hibernation socket attachments.
- Protocol-v1 hello, ping/pong, runtime parsing, and a 16 KiB pre-parse message cap.
- Generic authoritative game contracts and discovery metadata registry.
- Unit tests for selected protocol, route, and registry behavior plus lint/type/build/dry-run commands.

Avoid saying "production ready," "deployed," "ten games complete," or "fully tested" until the release evidence gates prove those statements.

## Architecture story

**Why Durable Objects?** A game room is a coordination atom: players need one ordered authority. `getByName(roomId)` sends the same room to the same object while unrelated rooms scale independently. There is intentionally no global room object.

**Why SQLite?** Durable storage, not browser or instance memory, is the source of truth. Accepted transitions should persist before broadcast and reconstruct after eviction/hibernation.

**Why WebSocket hibernation?** Multiplayer benefits from push, but continuously resident objects waste duration. Hibernation preserves connected sockets while eligible idle objects stop duration billing. Requests, active execution, and storage still count.

**How are games extensible?** A game module owns typed private state, bounded commands, deterministic authoritative transitions, and viewer-safe projections. Transport and room lifecycle remain platform concerns. The first real games should prove the adapter rather than force a speculative framework.

## Security and privacy story

The browser is adversarial. Room IDs, frames, display names, and commands are untrusted. Clients never assert score, winner, time, random result, or another player's identity. Hidden information stays in private state; only a whitelist projection for the current viewer crosses the wire. UI hiding is not security.

No accounts reduces scope but does not remove authorization needs. Before public games, the platform still needs room admission/seat binding, origin checks, rate/connection limits, reconnect identity, retention/expiry/deletion, abuse telemetry, and per-game hidden-state negative tests. "Ephemeral" is not claimed until cleanup is implemented and verified.

## Cost story

As checked 2026-08-22, Workers Free documents 100,000 dynamic requests/day and 10 ms CPU/invocation; static asset requests are documented as free/unlimited under the stated conditions. Durable Objects Free documents 100,000 requests/day, 13,000 GB-s/day, 5 million SQLite rows read/day, 100,000 rows written/day, and 5 GB stored. Incoming WebSocket messages receive a 20:1 request billing ratio; Hibernation avoids eligible idle duration. Limits are account-level and mutable, so the team must measure real room-minutes and games before claiming player capacity.

## Testing story

The automated baseline is type generation, four TypeScript configs, Vitest, ESLint, production build, Wrangler type check, deployment dry run, and startup check. The transport smoke is stronger than `101`: HTTPS health/root, WSS `server:hello`, nonce-preserving ping/pong, clean `1000` close, and no delayed server error. A shipped game additionally needs rules, malformed/illegal/concurrent commands, persistence/reconnect, 2/3/4-player convergence, room isolation, hidden projections, and real mobile/browser full-game evidence.

## Operational story

Release from a clean reviewed `main`, capture the previous and new Worker version IDs, deploy with a commit message, then run the live HTTPS/WSS contract and inspect error logs. Wrangler rollback can restore code/assets, but not Durable Object data, migrations, bindings, routes, or DNS. Data-shape changes therefore require compatibility or forward-fix planning.

## Likely questions

**Why not serverless stateless functions plus a database?** A database can persist state but does not itself provide one ordered in-memory/socket coordinator per room. A Durable Object combines deterministic routing, coordination, WebSockets, and local SQLite.

**What happens when two players move simultaneously?** Both intents arrive at one room authority and are ordered there. The game validates each against the current revision/state; stale/illegal commands must be rejected. Full revision/idempotency behavior remains a pre-game-launch gate.

**How do you prevent card leakage?** Never send the private state and remove fields afterward. Construct an explicit viewer-specific projection and assert in tests that every other player's secrets are absent, including errors/logs/reconnect payloads and side channels.

**What fails at free-tier limits?** Free-tier operations can fail after a limit is exceeded. The intended response is measured thresholds and safe new-room admission degradation, not accepting unpersisted moves. That overload control is not implemented yet.

**Can you roll back safely?** Code rollback is immediate when Cloudflare allows the target version, but storage/migrations/resources are unchanged. Backward-compatible schemas and forward fixes matter more than pretending rollback is universal.

**What would you build next?** Admission/origin/rate/expiry foundations, then one concrete game end-to-end to prove room lifecycle, persistence, reconnect, projections, mobile UX, and cost measurement before scaling toward ten.

## Evidence placeholders for a release interview

- Production URL and release SHA: `REPLACE_WITH_VERIFIED_URL_AND_SHA`
- Deployed/known-good Worker versions: `REPLACE_WITH_VERSION_IDS`
- Automated check output: `REPLACE_WITH_CI_OR_TERMINAL_EVIDENCE`
- HTTPS/WSS smoke and logs: `REPLACE_WITH_LIVE_EVIDENCE`
- Shipped game list and acceptance matrix: `REPLACE_WITH_GAME_EVIDENCE`
- Cost/dashboard snapshot date: `REPLACE_WITH_COST_EVIDENCE`
- Security/privacy review: `REPLACE_WITH_REVIEW_EVIDENCE`

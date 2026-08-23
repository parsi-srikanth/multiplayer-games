# Production checkpoint — 2026-08-23

## Shipped source scope

Seven authoritative games are implemented: Cows & Bulls Player Challenge, Cows & Bulls Classic, Word Race, Tic-Tac-Toe+, Dots & Boxes, Connect Four, and Sudoku Sprint. Classic and Word Race also execute locally for solo play. Memory Match, Trivia Blitz, and Category Blitz are deferred.

The Worker uses one SQLite Durable Object per room, hibernating WebSockets, five room creations and 30 room accesses per minute per client IP, a 16 KiB pre-parse message cap, a 30-minute reconnect grace period, and 24-hour inactivity cleanup by alarm. Multiplayer failures return bounded `429` or `503` responses with solo guidance.

## Verified checkpoint evidence

- 96 Node/jsdom tests and three Cloudflare Workers-runtime tests.
- TypeScript, ESLint, Vite production build, dependency audit, Wrangler dry run, and startup analysis.
- Local and public full-stack smoke: health, static assets, room creation, two WebSocket clients, hello/ping/pong, game selection and complete authoritative Tic-Tac-Toe+ round, reconnect with preserved identity, converged viewer projection, and clean closure.
- Automated axe scan plus headless Chromium production smoke at 320×568 and iPhone 13's 390×844 viewport, with no horizontal overflow or console/page errors and a usable create-room form.

This is not evidence for the full physical-device/browser matrix in `TESTING.md`.

## Production status

`https://games.srikanthparsi.com` is live on Cloudflare Worker version `6688f552-cf51-4f62-be58-840e85dcf9ca`. DNS, HTTPS, static assets, health, room creation, two WebSocket admissions, a complete authoritative Tic-Tac-Toe+ round, reconnect, synchronization, and clean closure were verified from the public custom domain. The architecture remains eligible for `$0/month under bounded free-tier usage`; this is conditional on traffic staying within Cloudflare's free allowances.

## Exact continuation point

1. Run the physical mobile/browser matrix and record evidence, including reconnect/background behavior.
2. Add live host-transfer coverage alongside the existing reconnect and complete-game smoke.
3. Implement Memory Match in an isolated reviewed PR.
4. Implement Trivia Blitz, then Category Blitz, in separate reviewed PRs.
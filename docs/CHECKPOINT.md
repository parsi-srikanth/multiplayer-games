# Production checkpoint — 2026-08-23

## Shipped source scope

Seven authoritative games are implemented: Cows & Bulls Player Challenge, Cows & Bulls Classic, Word Race, Tic-Tac-Toe+, Dots & Boxes, Connect Four, and Sudoku Sprint. Classic and Word Race also execute locally for solo play. Memory Match, Trivia Blitz, and Category Blitz are deferred.

The Worker uses one SQLite Durable Object per room, hibernating WebSockets, five room creations and 30 room accesses per minute per client IP, a 16 KiB pre-parse message cap, a 30-minute reconnect grace period, and 24-hour inactivity cleanup by alarm. Multiplayer failures return bounded `429` or `503` responses with solo guidance.

## Verified checkpoint evidence

- 96 Node/jsdom tests and three Cloudflare Workers-runtime tests.
- TypeScript, ESLint, Vite production build, dependency audit, Wrangler dry run, and startup analysis.
- Local and public full-stack smoke: health, static assets, room creation, two game clients plus a third election participant, hello/ping/pong, game selection and complete authoritative Tic-Tac-Toe+ round, reconnect with preserved identity, converged viewer projection, deterministic host election among two eligible connected players, and clean closure.
- The deployed release passed desktop Chromium, Firefox, and WebKit; Chromium 320px portrait/landscape; and iPhone 13 WebKit portrait/landscape. Every case had zero full-axe violations, console/page errors, or horizontal overflow, plus keyboard-focusable creation controls.
- A controlled rollback from `b4d18da6-a762-4903-acb7-3b5d045453ce` to `6688f552-cf51-4f62-be58-840e85dcf9ca` passed the public three-client smoke after deployment propagation, then an explicit 100% roll-forward to `b4d18da6-a762-4903-acb7-3b5d045453ce` passed both the public full-stack and seven-case browser matrices. The first immediate post-rollback handshake closed with `1006`; a bounded retry passed, so persistent recurrence remains an incident signal rather than an accepted result.

This is not evidence for the full physical-device/browser matrix in `TESTING.md`.

## Production status

`https://games.srikanthparsi.com` is live on Cloudflare Worker version `b4d18da6-a762-4903-acb7-3b5d045453ce`, released from merge `6c9649c4f485905c6ef7b97aba3096180c496c30`. Previous known-good version `6688f552-cf51-4f62-be58-840e85dcf9ca` was exercised in the rollback drill. DNS, HTTPS, static assets, health, room creation, three WebSocket admissions, a complete authoritative Tic-Tac-Toe+ round, reconnect, deterministic host election, synchronization, clean closure, and the browser matrix were verified from the public custom domain. The architecture remains eligible for `$0/month under bounded free-tier usage`; this is conditional on traffic staying within Cloudflare's free allowances.

## Exact continuation point

1. Optionally run physical iOS Safari and Android Chrome checks, especially reconnect/background and virtual-keyboard behavior; automated engine/viewport coverage is complete.
2. Await owner direction before starting any remaining game.
3. If approved later, implement Memory Match, then Trivia Blitz, then Category Blitz in separate reviewed PRs.
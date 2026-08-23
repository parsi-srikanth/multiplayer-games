# Production checkpoint — 2026-08-23

## Shipped source scope

Seven authoritative games are implemented: Cows & Bulls Player Challenge, Cows & Bulls Classic, Word Race, Tic-Tac-Toe+, Dots & Boxes, Connect Four, and Sudoku Sprint. Classic and Word Race also execute locally for solo play. Memory Match, Trivia Blitz, and Category Blitz are deferred.

The Worker uses one SQLite Durable Object per room, hibernating WebSockets, five room creations and 30 room accesses per minute per client IP, a 16 KiB pre-parse message cap, a 30-minute reconnect grace period, and 24-hour inactivity cleanup by alarm. Multiplayer failures return bounded `429` or `503` responses with solo guidance.

## Verified checkpoint evidence

- 96 Node/jsdom tests and three Cloudflare Workers-runtime tests.
- TypeScript, ESLint, Vite production build, dependency audit, Wrangler dry run, and startup analysis.
- Local full-stack smoke: health, static assets, room creation, two WebSocket clients, game selection/start, correlated authoritative command acknowledgement, and converged viewer projection.
- Automated axe scan and 320 CSS-pixel shell smoke.

This is not evidence for the full physical-device/browser matrix in `TESTING.md`.

## Production status

`games.srikanthparsi.com` is not deployed and does not resolve. The available Cloudflare token identifies the correct account but returns API authentication error `10000` for Workers deployment APIs. Release requires a token scoped to the target account and zone with Workers Scripts Edit, Workers Routes Edit, Zone Read, and DNS Edit. No paid feature is required.

## Exact continuation point

1. Supply the narrowly scoped Cloudflare release token.
2. Run the release commands in `DEPLOYMENT.md` from clean `main`.
3. Verify HTTPS, assets, health, room creation, WSS admission, two-client authoritative play, and reconnect on the custom domain.
4. Run the physical mobile/browser matrix.
5. Implement Memory Match, then Trivia Blitz, then Category Blitz in separate reviewed PRs.
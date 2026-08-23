# Testing and acceptance

> **Checkpoint status (2026-08-23):** seven games and the authoritative room lifecycle pass the automated and local full-stack evidence recorded in `CHECKPOINT.md`. Production deployment and the complete physical-device/browser matrix remain unverified.

## Automated baseline

From a clean checkout with Node.js 22+:

```bash
npm ci
npm run cf:typegen
npm run typecheck
npm test
npm run lint
npm run build
npx wrangler types --check
npx wrangler deploy --dry-run
npx wrangler check startup
```

`npm run check` aggregates type generation, typecheck, unit tests, lint, and build. Run it again after local Wrangler smoke testing because `.wrangler/` artifacts can reveal ignore/configuration problems.

Current tests cover protocol bounds, routing, room lifecycle/reconnect/cleanup, Durable Object persistence and hibernation behavior, executable game rules and projections, client adapters, accessibility, and a 320 CSS-pixel shell smoke. Local two-client WebSocket integration is recorded in `CHECKPOINT.md`; this is not a substitute for the full live and physical-device matrices below.

## Transport smoke contract

Use the exact local and live probes in [Deployment](DEPLOYMENT.md). A passing smoke requires all of the following:

1. `GET /api/health` returns HTTP `200` and JSON `{"status":"ok"}`.
2. `GET /` returns HTTP `200` and the built SPA document.
3. a valid room WebSocket upgrades;
4. the first frame is protocol-v1 `server:hello` with the requested room ID and a non-empty player ID;
5. `client:ping` receives `server:pong` with the same nonce;
6. the client sees a clean `1000` close; and
7. Wrangler/live logs show no delayed callback error.

The smoke proves only the implemented transport baseline. It does not prove admission, membership, reconnect recovery, game commands, hidden-state safety, or 2–4 player play.

## Multiplayer acceptance matrix

Run every row for **each shipped game**, with isolated room IDs. Record build SHA, environment, game/version, browser/device, UTC timestamp, result, and evidence URL.

| Scenario | 2 players | 3 players | 4 players | Acceptance |
| --- | --- | --- | --- | --- |
| Create/join and unique identity | Required | Required | Required | Exactly the intended players join; no duplicate seat or cross-room presence |
| Start constraints | Required | Required | Required | Starts only within the game's supported count and only once |
| Authoritative legal turn/action | Required | Required | Required | All viewers converge on one monotonically increasing revision |
| Illegal/out-of-turn/duplicate command | Required | Required | Required | Rejected without authoritative mutation or broadcast divergence |
| Hidden information | Required | Required | Required | Each viewer receives only its allowed projection; spectator/other player cannot infer secrets from payloads |
| Concurrent commands | Required | Required | Required | Deterministic ordering; one legal outcome; no lost or double-applied command |
| Refresh/reconnect | Required | Required | Required | Rejoins according to policy and receives a fresh authoritative projection/revision |
| Disconnect during active game | Required | Required | Required | Documented timeout/forfeit/rejoin behavior; remaining clients stay consistent |
| Terminal state/rematch | Required | Required | Required | Winner/draw is server-derived; post-terminal commands rejected; rematch isolates state |
| Room isolation | Required | Required | Required | Same commands in another room cannot read, mutate, or receive this room's state |
| Hibernation/restart recovery | Required | Required | Required | Durable state/socket attachments reconstruct correctly; memory is not required for truth |
| Malformed/oversized/rate burst | Required | Required | Required | Bounded rejection/close; room remains available to well-behaved clients |

Solo-capable games must additionally prove a full legal game, restart, terminal state, and offline/no-socket behavior if advertised. Do not mark multiplayer complete from two browser tabs alone; include separate devices/networks before release.

## Mobile and browser acceptance matrix

Minimum release matrix; update versions at the release date.

| Class | Target | Portrait | Landscape | Touch/gameplay | Reconnect/background | Accessibility |
| --- | --- | --- | --- | --- | --- | --- |
| iPhone | Current Safari on one small and one modern viewport | Required | Required | Required | Required | Zoom, labels, focus, contrast |
| Android | Current Chrome on one narrow and one common viewport | Required | Required | Required | Required | Font scaling, labels, focus, contrast |
| Tablet | Current iPadOS Safari or Android Chrome | Required | Required | Required | Required | Keyboard where available |
| Desktop | Current Chrome, Firefox, Safari, and Edge | N/A | Required | Pointer + keyboard | Required | Keyboard-only and screen-reader smoke |

Acceptance for every supported target:

- no horizontal page overflow at 320 CSS px width unless the game board intentionally pans;
- controls have usable touch targets and are not hidden by safe areas, browser chrome, or the virtual keyboard;
- orientation changes preserve authoritative state and usable layout;
- no hover-only or color-only instruction;
- loading, rejection, reconnecting, disconnected, and terminal states are visible;
- animation respects reduced-motion preferences;
- no mixed content, certificate warning, uncaught console error, or repeated socket loop;
- a complete game can be played without accidental page zoom/scroll blocking essential controls.

## Game-specific evidence gate

Before listing a game as shipped:

- [ ] deterministic rules tests, including illegal and terminal paths;
- [ ] runtime command bounds, including nested/large payload cases;
- [ ] per-viewer projection tests with explicit negative assertions for every secret;
- [ ] persistence/recovery and revision tests;
- [ ] all applicable multiplayer matrix rows;
- [ ] all mobile/browser matrix targets;
- [ ] local transport smoke and production HTTPS/WSS smoke;
- [ ] evidence index: `REPLACE_WITH_GAME_RELEASE_EVIDENCE_URL`.

Release summary: `REPLACE_WITH_SHA_DATE_ENVIRONMENT_AND_APPROVER`.

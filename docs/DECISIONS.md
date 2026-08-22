# Architecture decision record

This is a concise baseline ADR log. Status is **accepted for the foundation** unless marked otherwise; implementation-specific claims remain subject to tests and release evidence.

## ADR-001: One Worker deployment with static assets

**Decision:** serve the Vite SPA and `/api/*` from one Cloudflare Worker deployment.

**Why:** smallest operational surface, one origin/domain, and no separate hosting bill. **Tradeoff:** frontend/backend releases are coupled and a Worker/configuration issue can affect both. Revisit if independent release cadence, cache policy, or teams justify separation.

## ADR-002: One Durable Object per room

**Decision:** route validated room IDs with `ROOMS.getByName(roomId)` to one SQLite-backed Durable Object per room; no global coordinator.

**Why:** strong per-room ordering and natural horizontal isolation. **Tradeoff:** no global matchmaking/search and a single hot room is still single-thread coordinated. Revisit only with measured need; avoid one global DO.

## ADR-003: Server-authoritative commands and viewer projections

**Decision:** clients send bounded intents; the room applies rules and emits explicit viewer-safe `PublicState` projections.

**Why:** reduces cheating and creates a testable hidden-state boundary. **Tradeoff:** more server/game-adapter work and latency; client prediction may animate but cannot commit results. Any game that cannot express secrets through projections needs a security ADR before launch.

## ADR-004: SQLite storage is truth; memory is cache

**Decision:** persist accepted authoritative transitions before notifying clients and reconstruct after eviction/hibernation.

**Why:** correctness survives object lifecycle changes. **Tradeoff:** writes/reads consume free-tier limits and schema evolution complicates rollback. Every data-shape release needs backward compatibility or a forward-fix plan.

## ADR-005: Hibernation WebSockets over polling

**Decision:** use Durable Object Hibernation WebSockets and serialized socket attachments.

**Why:** real-time interaction with low idle duration cost. **Tradeoff:** reconnect, attachment restoration, close handling, and abuse controls are more complex; a successful `101` is not lifecycle proof.

## ADR-006: Versioned shared protocol with runtime validation

**Decision:** use discriminated JSON messages, numeric protocol version, pre-parse 16 KiB UTF-8 cap, and runtime validation.

**Why:** TypeScript cannot protect a network boundary and bounded messages protect CPU/memory. **Tradeoff:** validators and compatibility paths require maintenance. Prefer additive changes; breaking changes need rollout compatibility.

## ADR-007: Modular game contracts, not services

**Decision:** each game is a typed rules/projection module behind stable contracts and registry metadata, not a new Worker/service.

**Why:** makes game 11 additive and keeps deployment/cost small. **Tradeoff:** the shared room adapter can become over-generalized. Build abstractions from concrete games; do not claim ten games before each passes its acceptance gate.

## ADR-008: No accounts, paid services, or global matchmaking for MVP

**Decision:** room-link participation, no auth/account/payment/chat/ranking/analytics service in the baseline.

**Why:** limits scope, personal-data collection, operations, and cost. **Tradeoff:** weak identity, discoverability, moderation, and room admission. Public multiplayer still requires origin, admission capability, seat binding, and abuse controls; "no auth" does not mean "no authorization boundary."

## ADR-009: Free-tier-first, single-account operation

**Decision:** design around current Workers and SQLite Durable Objects Free limits and measure before upgrading.

**Why:** mission requires no paid service. **Tradeoff:** daily hard failures, shared account quotas, and denial-of-wallet/exhaustion risk. Thresholds and safe admission degradation must precede traffic; paid adoption requires a cost ADR.

## ADR-010: Mobile-first acceptance is a release gate

**Decision:** every shipped game must pass the multiplayer and device/browser matrices in [Testing](TESTING.md).

**Why:** responsive screenshots do not prove touch, reconnect, orientation, or full-game usability. **Tradeoff:** broader manual/device testing slows releases. Automate where useful but retain real-device evidence.

## ADR-011: Direct Wrangler release with explicit rollback evidence

**Decision:** until CI deployment is deliberately added, release from a clean reviewed `main` commit with exact commands in [Deployment](DEPLOYMENT.md), capture version IDs, and verify HTTPS/WSS live.

**Why:** current GitHub OAuth lacks workflow scope and current Cloudflare token lacks required deployment access. **Tradeoff:** manual execution is less repeatable and relies on operator discipline. Revisit when credentials/scopes support protected CI/CD.

## Open decisions / evidence required

| Topic | Gate before decision |
| --- | --- |
| Room capability/admission and reconnect identity | Threat model, UX, replay/guess resistance tests |
| Retention and room expiry | Privacy period, cleanup implementation, deletion evidence, cost measurement |
| Event log vs compact snapshot | Recovery needs and measured row/storage cost from first game |
| Seeded randomness/fairness | First random game's audit/replay requirements |
| Rate-limit values and safe overload behavior | Multiplayer load/abuse tests and free-tier model |
| CI/CD and staged environments | Credential ownership, protected branch/environment, rollback drill |
| SLO/status/alerting | Production traffic and operator capacity |

Add future ADRs with date, status, context, decision, alternatives, consequences, and evidence links. Do not rewrite history silently; supersede prior decisions explicitly.

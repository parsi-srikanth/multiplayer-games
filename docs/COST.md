# Cost model and free-tier guardrails

> **Status and source date:** planning baseline checked **2026-08-22** against Cloudflare documentation. Limits and prices can change; re-check linked sources on every release. Account plan, unrelated account usage, logs, DNS, and future products can alter the result.

## Current deployment shape

One Worker serves static assets and API routes. One SQLite-backed Durable Object coordinates each room using Hibernation WebSockets. There is no paid database, authentication service, analytics vendor, or application secret in the baseline.

## Workers Free plan limits

| Meter | Documented free limit | Relevance |
| --- | ---: | --- |
| Dynamic Worker requests | 100,000/day, reset 00:00 UTC | Health/API and initial Worker WebSocket upgrades consume requests |
| CPU | 10 ms per invocation | Parsing and routing must stay small; exceeding can return resource errors |
| Memory | 128 MB per isolate | Do not buffer large input/state |
| Static asset requests | Free and unlimited | Applies to asset requests under Cloudflare's stated static-assets billing rules |
| Static files/version | 20,000 | Build output must stay below this |
| Individual static file | 25 MiB | Keep bundles/assets under this |

Source: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) and [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), checked 2026-08-22. Static asset requests can become billed Worker requests if Workers Cache is explicitly enabled as described by Cloudflare; re-check configuration and policy.

## Durable Objects Free plan limits

| Meter | Documented free limit | Behavior/relevance |
| --- | ---: | --- |
| Requests | 100,000/day | Includes HTTP/RPC/alarm requests; incoming WS messages use a 20:1 billing ratio |
| Duration | 13,000 GB-s/day | Hibernation avoids idle eligible duration; active handlers still consume duration |
| SQLite rows read | 5,000,000/day | Snapshot/event queries count |
| SQLite rows written | 100,000/day | State writes, deletes, and alarms count |
| SQLite stored data | 5 GB total | Data remains metered until removed |

On Free, exceeding a free-tier operation limit causes further operations of that type to fail; daily free limits reset at 00:00 UTC. Workers Free can create/access SQLite-backed, not legacy KV-backed, Durable Objects. A WebSocket connection requires a request; outgoing messages and protocol pings are not charged as Durable Object requests, and incoming application messages are billed at 20 messages to one request. Hibernation removes eligible idle-duration charges, not request/storage usage.

Source: [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), checked 2026-08-22.

## Capacity interpretation

These are account-level ceilings, not a service-level objective or guaranteed game capacity. The tightest meter wins and other projects on the same account share allocations. Traffic shape matters:

- connection churn consumes Worker and Durable Object requests;
- 2–4 players sending frequent commands consume incoming-message request units;
- every authoritative transition can consume SQLite rows written;
- reconnect/snapshot patterns consume rows read;
- non-hibernatable work, timers, or outbound connections increase duration;
- logs/observability and future services may have separate limits or paid-plan availability.

Do not convert these limits into a published "players supported" claim until production measurements provide requests, CPU, duration, reads, and writes per room-minute and per complete game.

## Zero-cost operating guardrails

1. Remain explicitly on Workers Free; enabling Workers Paid creates at least the current documented minimum subscription charge.
2. Use static assets for UI and Hibernation WebSockets for sparse room traffic; do not poll.
3. Persist compact snapshots/events and delete expired rooms after the retention policy is implemented.
4. Bound messages at 16 KiB and rate-limit connections/commands before public launch.
5. Avoid chat, analytics pipelines, paid APIs, outbound keepalive connections, or new Cloudflare products without a cost ADR.
6. Monitor at least Worker requests/CPU/errors, DO requests/duration, SQLite reads/writes/storage, socket churn, and room count.
7. Treat 70% of any daily limit as warning, 85% as release/traffic freeze, and 95% as incident threshold until measured thresholds are approved.
8. Prefer safe degradation (reject new room creation while allowing bounded active-room completion) over silent inconsistency. This behavior is a requirement, not yet an implemented claim.

## Release cost evidence gate

- [ ] Re-check all linked pricing/limits; record date and plan.
- [ ] Confirm account has not been upgraded and no new paid product/binding is enabled.
- [ ] Record bundle size/file count and dry-run output.
- [ ] Record measured per-game session requests, CPU, DO duration, rows read/written, and storage delta.
- [ ] Configure/verify available usage notifications or a manual daily review owner.
- [ ] Verify expiry/deletion and estimate steady-state storage.
- [ ] Approve traffic thresholds and degradation behavior.
- [ ] Evidence/dashboard links: `REPLACE_WITH_COST_EVIDENCE_URLS`.

A future paid-plan decision must include expected monthly usage, minimum subscription, overage rates, abuse headroom, alerting, and an owner in [Decisions](DECISIONS.md).

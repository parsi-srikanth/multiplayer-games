# Operations runbook

> **Status:** baseline runbook. Production dashboards, alert delivery, room expiry, and incident evidence are not yet established.

## Service inventory

- Public target: `https://games.srikanthparsi.com`
- Worker: `parsi-games`
- Health: `GET /api/health`
- Room socket: `GET /api/rooms/:roomId/connect` with WebSocket upgrade
- State: one SQLite-backed `RoomDurableObject` per validated room ID
- Static assets: Worker `ASSETS` binding from `dist/`
- Observability in config: enabled, 10% head sampling, invocation logs enabled

No external status page, pager, SLO, or recovery-time guarantee is claimed.

## Routine checks

Use the [Deployment live contract](DEPLOYMENT.md#live-verification) after every release and when availability is questioned.

```bash
curl --fail --silent --show-error --proto '=https' --tlsv1.2 \
  https://games.srikanthparsi.com/api/health
npx wrangler versions list --json
npx wrangler tail parsi-games --format pretty
```

For an error-only tail:

```bash
npx wrangler tail parsi-games --status error
```

Do not paste raw private room payloads or credentials into issues. Record UTC timestamps, symptoms, request/room-safe correlation identifiers, release version, and sanitized log links.

## Release operations

Use [Deployment and rollback](DEPLOYMENT.md), never an unrecorded dashboard edit. Before release, designate release operator, incident/rollback owner, known-good version, and a 15-minute live verification window. Changes to DNS, routes, Durable Object migrations, bindings, or stored-data shape require an explicit compatibility/forward-fix plan because code rollback does not revert them.

## Incident triage

1. **Declare and timestamp.** Assign incident lead and recorder; stop releases.
2. **Scope.** Test root HTTPS, health API, WSS upgrade/hello/pong/close, one new room, and one existing room if safe.
3. **Correlate.** Compare onset with Worker version, DNS/certificate, account limits, Cloudflare status, and recent traffic.
4. **Protect correctness/privacy.** If state may diverge or leak, stop new room admission before optimizing availability. This control must be implemented before launch; until then, use rollback or route disablement through an authorized operator.
5. **Mitigate.** Roll back code when compatible; otherwise forward-fix. Never delete room storage as a first response.
6. **Verify.** Repeat complete HTTPS/WSS smoke and inspect error tail.
7. **Communicate.** State observed impact and uncertainty; do not claim data safety until checked.
8. **Close/follow up.** Preserve sanitized evidence and assign root-cause/remediation owners.

## Symptom guide

| Symptom | Check | Likely response |
| --- | --- | --- |
| DNS/TLS failure | Zone DNS, custom domain, certificate, Cloudflare status | Restore route/DNS with authorized change; verify HTTPS before WSS |
| Root fails, health succeeds | Asset build/upload and SPA binding | Compare deployment version/dry-run; rollback compatible Worker |
| Health fails globally | Worker errors, request/CPU limits, deployment | Tail errors, inspect usage/version; rollback or reduce traffic |
| WSS fails but HTTPS works | Upgrade route, DO binding/migration, origin/admission policy | Run hello/ping contract and inspect close/error logs |
| One room fails | Room-specific malformed/large state or hot-room abuse | Preserve room evidence; isolate admission; do not affect other rooms |
| State disagreement | Revisions, persistence-before-broadcast, reconnect projection | Treat as correctness incident; halt new games and forward-fix/rollback |
| Secret/private state visible | Payload/log/projection paths | Treat as security incident; stop exposure, preserve minimal evidence, rotate any credentials |
| Free-tier operations fail | Worker/DO request, duration, read/write/storage usage | Freeze new rooms; identify abuse/churn; do not silently accept commands |

## Recovery and data boundaries

Worker versions are recoverable through Wrangler rollback. Static assets deploy with Worker versions. Durable Object storage has no repository-defined backup/restore mechanism yet, and rollback does not reverse data or migrations. Room state is intended to be ephemeral, but expiry/deletion is not implemented; define retention, cleanup, and any recovery expectation before production games.

## Maintenance

- Monthly and before release: re-run all quality/dry-run/startup checks and review dependencies.
- Before changing `compatibility_date`: test locally, review Cloudflare compatibility changes, then release normally.
- Quarterly: review API-token permissions/rotation, documentation links, threat model, cost limits, and operational ownership.
- Per game: measure command rate, state size, SQLite operations, reconnect behavior, and hidden-state projection.

## Operational readiness evidence gate

- [ ] Primary and backup operator: `REPLACE_WITH_OWNERS`
- [ ] Dashboard/usage links and access verified: `REPLACE_WITH_URLS`
- [ ] Alert channels and thresholds tested: `REPLACE_WITH_EVIDENCE`
- [ ] Retention/expiry/deletion job verified: `REPLACE_WITH_EVIDENCE`
- [ ] Known-good version and rollback drill: `REPLACE_WITH_VERSION_AND_EVIDENCE`
- [ ] Incident/security contacts published: `REPLACE_WITH_CONTACTS`
- [ ] First production HTTPS/WSS smoke: `REPLACE_WITH_EVIDENCE`
- [ ] Post-incident template/location: `REPLACE_WITH_URL`

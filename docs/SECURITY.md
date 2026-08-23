# Security, privacy, and threat boundaries

> **Status:** baseline threat model, not a security certification. Public multiplayer launch remains gated on the deferred controls below.

## Data and trust boundaries

- The browser, every WebSocket frame, URL, display name, room ID, and game command are untrusted.
- The stateless Worker validates the route and overwrites internal room context before deterministic Durable Object routing.
- One SQLite-backed Durable Object is the authority for one room. Clients submit intents, never outcomes, scores, turns, winners, time, or random results.
- Durable storage is authoritative; instance memory and client caches are disposable.
- `State` may contain secrets. `PublicState` is an explicit, viewer-specific projection and is the only game state permitted on the wire.
- Static assets and protocol metadata are public. The baseline has no account system, authentication, payment data, analytics pipeline, or intentionally collected personal profile.

## Privacy boundary

Room IDs, display names, player IDs, IP/platform request metadata, commands, timings, and logs can still be personal or linkable data even without accounts. The product must minimize collection:

- use ephemeral room/player identifiers and avoid real-name prompts;
- do not add chat, email, advertising identifiers, fingerprinting, or third-party analytics without a new privacy review;
- do not log raw commands, room secrets, hidden game state, display names, admission tokens, or full IP addresses;
- document actual SQLite retention/cleanup before launch; "ephemeral" is a product policy only after expiry and deletion are implemented and verified;
- provide a public privacy notice before collecting production traffic and document Cloudflare as infrastructure processor/subprocessor as applicable;
- honor deletion/incident obligations that apply to the operating jurisdiction.

**Current evidence limit:** the architecture intends ephemeral rooms, but automated expiry/deletion and a verified retention period are not yet implemented. Do not claim that production room data is automatically deleted.

## Hidden-state boundary

For card hands, answers, roles, private objectives, unrevealed choices, or random seeds:

1. keep full state only in the room authority;
2. derive a projection with an explicit viewer identity;
3. whitelist safe fields rather than deleting known-secret fields from a shared object;
4. send no hidden values in errors, logs, revisions, HTML, source maps, socket attachments, or "debug" payloads;
5. test each player, spectator, reconnect, terminal/reveal phase, and malformed identity path with negative assertions;
6. treat aggregate counts, ordering, IDs, payload size, and timing as potential side channels.

Client code cannot protect a secret it receives. UI hiding is not an access control.

## Primary threats and controls

| Threat | Baseline control | Required before public games |
| --- | --- | --- |
| Cross-room access | Constrained room IDs and one DO per deterministic room key | Unpredictable/admission-scoped room capability; enumerate/guess tests |
| Command forgery/cheating | Server-authoritative intent processing contract | Authenticated room membership/seat binding and game-specific validation |
| Hidden-state disclosure | Viewer-specific `projectState` contract | Negative projection tests and payload/log review per game |
| Parser/CPU/memory abuse | Text-only frames and 16 KiB UTF-8 cap before parse | Deep/nested command bounds, per-connection/room rate limits, abuse metrics |
| Socket/resource exhaustion | Hibernation WebSockets | Admission limits, connection caps, idle/room expiry, origin policy |
| Replay/duplicate/race | Durable Object serialization boundary | Command IDs/revisions, idempotency policy, stale-command rejection |
| XSS/content injection | React escaping by default | No unsafe HTML; CSP/security headers review; sanitize any rich text |
| CSWSH/cross-origin use | None claimed | Explicit allowed-origin validation and tests before launch |
| Token/credential leakage | No baseline app secret; secrets excluded from source | Least-privilege Wrangler token, rotation, CI masking, secret scan |
| Dependency/supply-chain compromise | Lockfile and `npm ci` | Dependabot/audit policy, reviewed upgrades, provenance where practical |
| Data persistence after room end | None claimed | TTL/cleanup implementation, deletion test, retention runbook |
| Denial of wallet/free-tier exhaustion | Small architecture and hibernation | Usage alerts/caps, rate limits, incident threshold and fail-safe behavior |

Cloudflare network protections do not replace application admission, authorization, validation, or rate limiting.

## Protocol rules

- Enforce the 16 KiB application limit before `JSON.parse`; platform limits are not application limits.
- Reject binary, invalid, unknown-version, unbounded, and game-invalid input without mutating state.
- Bound strings, arrays, numbers, nesting, and every game-specific `command`, including unknown properties.
- Persist accepted transitions before acknowledgement/broadcast.
- Normalize invalid/reserved WebSocket close codes; do not echo `1005` or `1006` into `close()`.
- Reconnects must request a fresh viewer-safe projection and cannot select another player's identity.

## Credential and deployment boundary

Use a dedicated least-privilege Cloudflare API token. The intended first-deploy permissions are **Account Workers Scripts Edit**, **Zone Workers Routes Edit**, **DNS Edit**, and **Zone Read**. Never commit `.dev.vars`, API tokens, cookies, private keys, or release output containing credentials. If a future secret is required, set it interactively with:

```bash
npx wrangler secret put NAME
```

## Security release gate

- [ ] Origin/admission/membership policy implemented and tested.
- [ ] Per-player, per-room, and connection rate/size limits implemented and measured.
- [ ] Every shipped game passes hidden-state negative tests.
- [ ] Retention, room expiry, and deletion are implemented and verified.
- [ ] Security headers and browser console/network payloads reviewed.
- [ ] Abuse and incident telemetry avoids private payloads.
- [ ] `npm audit` findings triaged and automated tests/checks pass.
- [ ] Live HTTPS/WSS smoke and unauthorized/malformed probes recorded.
- [ ] Privacy notice and contact/incident owner published.
- [ ] Evidence: `REPLACE_WITH_SECURITY_REVIEW_URL_AND_DATE`.

Report vulnerabilities privately to `REPLACE_WITH_SECURITY_CONTACT` until a repository security policy/contact is established; do not include exploitable details in a public issue.

# Learning notes — Cloudflare multiplayer

## Why this stack

A conventional React client plus ASP.NET/Azure service would fit the owner's professional stack, but small real-time rooms need ordered coordination and long-lived sockets while the project requires near-zero idle cost. One Cloudflare Worker plus one Durable Object per room provides deterministic room routing, WebSocket ownership, and local SQLite persistence without an always-on server.

## Concepts worth remembering

### Durable Object identity

`env.ROOMS.getByName(roomCode)` always routes the same name to the same object. The object is the room's coordination authority, not a global singleton. Different room codes can execute independently.

### SQLite storage

SQLite-backed Durable Object storage is strongly consistent within the object. Parsi Games stores one compact snapshot, enforces a 128 KiB serialized limit, and persists before acknowledgement/broadcast. Code rollback does not roll back this data.

### WebSocket hibernation

`ctx.acceptWebSocket()` lets Cloudflare hibernate an idle object while retaining its sockets. Attachments restore the minimum session identity/rate-limit context after wake. Hibernation reduces eligible idle-duration usage; it does not eliminate request, message, alarm, or storage meters.

### Alarms and expiry

An alarm schedules the earliest reconnect, pre-admission, or 24-hour room expiry. Every access also checks expiration synchronously because an alarm may run later than its requested time. Expiry closes sockets, deletes the alarm, and deletes all room storage.

### Viewer-specific projections

Authoritative private state remains server-side. A game projects only what one player may see. Browser import boundaries matter too: the client-safe registry imports only offline-safe definitions, while Sudoku generation and validation stay in the Worker bundle.

## Key commands

```bash
npm run check
npm run smoke:full-stack
npm run smoke:browsers
npx wrangler deploy --dry-run
npx wrangler check startup
npx wrangler versions list
npx wrangler versions view <VERSION_ID>
npx wrangler rollback <VERSION_ID> --message "reason" --yes
```

Always run public smoke tests after deploy or rollback. Never assume rollback changes Durable Object data, migrations, DNS, or bindings.

## Comparison with familiar alternatives

| Concern | Durable Objects | ASP.NET + SignalR + SQL |
| --- | --- | --- |
| Room ordering | Natural single object authority | Requires hub/backplane/locking design |
| Socket ownership | Built into the room object | SignalR host plus scale-out coordination |
| Idle operations | Hibernation-compatible serverless runtime | Usually an always-on plan or more platform setup |
| Persistence | Object-local SQLite | External SQL/Cosmos dependency |
| Portability | Cloudflare-specific APIs | Broader .NET ecosystem portability |
| Operational familiarity | New adjacent skill | Existing professional strength |

The current choice is appropriate for bounded public rooms. Revisit it only when measured traffic, data access, regional requirements, or operational constraints exceed the model—not merely because another stack is more familiar.

## Likely interview prompts

- Why does a room map well to an actor/Durable Object?
- What survives hibernation and what must be reconstructed?
- Why persist before broadcasting?
- Why are alarms plus synchronous expiry checks both needed?
- What does code rollback fail to restore?
- How do viewer projections and browser bundle boundaries protect hidden state?

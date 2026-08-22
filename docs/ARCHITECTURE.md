# Architecture

## Goals

1. Keep the free-tier MVP operationally small: one Worker deployment, static assets, and per-room Durable Objects.
2. Make each room an independent coordination atom with authoritative server state.
3. Make adding game 11 the same operation as adding game 1: a module behind stable contracts, not a new service.
4. Keep browser-visible state explicitly separate from private authoritative state.

## Request and connection flow

```text
Browser
  │ HTTPS / static files
  ▼
Cloudflare Worker ───────► ASSETS binding (Vite dist)
  │
  │ GET /api/rooms/:roomId/connect + Upgrade: websocket
  ▼
ROOMS.getByName(roomId)
  │ deterministic routing
  ▼
RoomDurableObject (one logical instance per room)
  ├── Hibernation WebSockets
  ├── SQLite storage
  └── future selected GameDefinition<State, Command, PublicState>
```

The Worker is stateless. It validates the route and WebSocket upgrade, stamps trusted room context, then forwards to the room Durable Object. It does not maintain a global room directory. `getByName(roomId)` guarantees that clients using the same room ID reach the same object while unrelated rooms scale independently.

## Runtime boundaries

### Client (`src/client`)

The React SPA renders discovery, lobby, and game UIs. It may predict animation for responsiveness, but must never decide an authoritative game result. Network code should consume only types from `src/shared/protocol.ts`.

### Edge router (`src/worker/index.ts`)

A single Worker:

- responds to explicit `/api/*` routes;
- maps a validated room ID to `ROOMS.getByName(roomId)`;
- delegates non-API requests to the static asset binding;
- owns HTTP-level concerns, not game rules.

### Room Durable Object (`src/worker/room-durable-object.ts`)

The room is the unit of isolation, consistency, storage, and scale. The foundation accepts Hibernation API WebSockets, attaches stable per-connection metadata, supports protocol ping/pong, and rejects game commands until a game runtime exists.

Future room work belongs behind focused interfaces for membership, lifecycle, and game execution. Persist authoritative transitions before notifying clients. Rebuild transient indexes after hibernation from SQLite and WebSocket attachments; never rely on module-level or instance-only state for correctness.

### Shared game contracts (`src/shared`)

`GameDefinition<State, Command, PublicState>` is deliberately generic:

- `State` is private server state.
- `Command` is a validated player intent, never a claimed outcome.
- `PublicState` is an explicit projection safe for one viewer.
- `applyCommand` is the authoritative transition.
- `GameContext.now` makes time an input rather than a hidden dependency.

The protocol is a discriminated union with a numeric version. Runtime parsing occurs at the trust boundary. Additive protocol evolution is preferred; breaking changes require a new version and a compatibility plan.

The discovery registry stores metadata only today. The first game should add a typed runtime adapter rather than weakening contracts with `any` or unsafe casts.

## Persistence model

The `v1` Wrangler migration creates `RoomDurableObject` as a SQLite-backed class. Its constructor idempotently establishes a small `room_metadata` table. A future room implementation should add tables for room configuration, players, and authoritative event/snapshot state with an additional Durable Object migration tag when the class migration shape changes. Application schema changes remain idempotent SQL managed by the class.

SQLite operations inside a Durable Object are strongly ordered. Related writes should be performed without unrelated external awaits between them. Storage is the source of truth; memory is a cache.

## WebSocket lifecycle and cost

The room uses Cloudflare's Hibernation WebSocket API (`ctx.acceptWebSocket`) so idle rooms can leave memory while connections remain attached. Per-connection identity is stored with `serializeAttachment`, allowing reconstruction after hibernation. This minimizes billable duration and fits the free-tier MVP better than polling or a continuously active coordinator.

The transport currently has no global broadcast, matchmaking, presence, or game loop. Those are intentionally deferred.

## Security and abuse boundaries

- Room IDs are constrained before Durable Object lookup.
- The Worker overwrites internal room context; clients cannot choose the trusted header value.
- All WebSocket payloads are parsed as untrusted input. Text frames are capped at 16 KiB before `JSON.parse`; binary and oversized frames are closed with WebSocket policy codes. Protocol and game validators add field/type bounds.
- Server projections must prevent hidden-state disclosure.
- No secrets live in source or Wrangler config.
- Future production room work must add per-player command rate limits, origin policy, room admission tokens, and structured abuse metrics before public game launch.

## Operations

- `compatibility_date` is pinned and `nodejs_compat` is explicit.
- Worker logs and traces are enabled with 10% head sampling to control cost.
- Source maps are emitted for diagnosability.
- `wrangler types` generates binding types from config; `Env` is never handwritten.
- Deployment validation uses `wrangler deploy --dry-run` before a real deploy.
- The custom domain is `games.srikanthparsi.com`; DNS and account authorization remain deployment concerns.

## Failure model

A room fails independently. Durable Object restarts and hibernation erase in-memory data, so durable state and socket attachments must be sufficient to continue. Clients should eventually reconnect with bounded exponential backoff and request a fresh projected snapshot. A malformed command is rejected to its sender and must not mutate state.

## Current non-goals

- Implementing individual games
- Matchmaking or searchable room lists
- User accounts, chat, rankings, or analytics pipelines
- Cross-room coordination
- Multi-Worker microservices
- A generalized room engine before a real game proves its needs

## Sources consulted

Current Cloudflare documentation was retrieved before implementation:

- [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
- [Durable Objects WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [Durable Object migrations](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/)
- [Static asset bindings](https://developers.cloudflare.com/workers/static-assets/binding/)

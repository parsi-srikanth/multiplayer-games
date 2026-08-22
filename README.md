# Parsi Games

A production-oriented foundation for lightweight, authoritative multiplayer browser games at **[games.srikanthparsi.com](https://games.srikanthparsi.com)**.

## What is here

- React + TypeScript + Vite single-page UI
- One Cloudflare Worker serving static assets and `/api/*`
- One SQLite-backed Durable Object instance per room
- Cost-conscious WebSocket hibernation transport
- Versioned shared protocol and generic game contracts
- Strict TypeScript, ESLint, Vitest, build, and Wrangler validation

This foundation intentionally does **not** implement a game, matchmaking, accounts, or full room lifecycle yet. Those features should arrive as focused modules without changing the deployment shape.

## Quick start

Prerequisites: Node.js 22+ and a Cloudflare account for deployment.

```bash
npm install
npm run cf:typegen
npm run dev          # Vite UI only
npm run dev:worker   # full Worker + assets + local Durable Objects
```

Open the URL printed by Wrangler for full-stack local development.

## Quality commands

```bash
npm run typecheck
npm test
npm run lint
npm run build
npm run deploy:dry-run
npm run check
```

## Runtime routes

| Route | Purpose |
| --- | --- |
| `GET /api/health` | Stateless health response |
| `GET /api/rooms/:roomId/connect` | WebSocket upgrade routed deterministically to one room Durable Object |
| all other non-API paths | Vite assets with SPA fallback |

Room IDs are lowercase alphanumeric with internal hyphens, 3–64 characters.

## Project map

```text
src/
  client/                 React application
  games/                  independent game modules and discovery registry
  shared/                 game contracts and network protocol
  worker/                 Worker router and room Durable Object
docs/
  ARCHITECTURE.md          system boundaries and production decisions
  GAME_DEVELOPMENT.md      how to add a game module
wrangler.jsonc             Worker, assets, route, Durable Object, and migration config
```

## Deployment

`wrangler.jsonc` declares the custom domain, asset binding, Durable Object binding, and the initial `new_sqlite_classes` migration. Authenticate Wrangler locally or in the deployment system, then:

```bash
npm run check
npm run deploy:dry-run
npx wrangler deploy
```

No secrets are required by this baseline. If a future feature needs one, use `wrangler secret put NAME`; never commit `.dev.vars` or credentials.

See [Architecture](docs/ARCHITECTURE.md) and [Game Development](docs/GAME_DEVELOPMENT.md).

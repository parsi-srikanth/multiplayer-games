# Parsi Games

A mobile-first, server-authoritative multiplayer game collection targeting **[games.srikanthparsi.com](https://games.srikanthparsi.com)**.

## What is here

- React + TypeScript + Vite single-page UI
- One Cloudflare Worker serving static assets and `/api/*`
- One SQLite-backed Durable Object instance per room
- Cost-conscious WebSocket hibernation transport
- Versioned shared protocol and generic game contracts
- Strict TypeScript, ESLint, Vitest, build, and Wrangler validation

## Playable checkpoint

The current release checkpoint includes Cows & Bulls Player Challenge, Cows & Bulls Classic, Word Race, Tic-Tac-Toe+, Dots & Boxes, Connect Four, and Sudoku Sprint. Classic and Word Race support offline local solo play; the other games use authoritative Worker rooms. Memory Match, Trivia Blitz, and Category Blitz remain clearly marked post-checkpoint work.

The checkpoint is live on the canonical custom domain; see [the checkpoint record](docs/CHECKPOINT.md) for verified scope and remaining work.

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
| `POST /api/rooms` | Allocate a rate-limited multiplayer room |
| `GET /api/rooms/:roomId` | Read bounded public room information |
| `GET /api/rooms/:roomId/connect` | WebSocket upgrade routed deterministically to one room Durable Object |
| all other non-API paths | Vite assets with SPA fallback |

Room codes are five cryptographically generated uppercase characters from an ambiguity-reduced alphabet.

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
  DEPLOYMENT.md            local, release, live verification, and rollback runbook
  TESTING.md               automated, multiplayer, and mobile acceptance gates
  SECURITY.md              privacy, hidden-state, and threat boundaries
  COST.md                  free-tier limits and operating guardrails
  OPERATIONS.md            monitoring and incident response runbook
  DECISIONS.md             architecture decision record
  INTERVIEW_BRIEF.md       concise system narrative and verified evidence
  LEARNING_NOTES.md        Cloudflare concepts, tradeoffs, and study notes
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

See the handbook:

- [Architecture](docs/ARCHITECTURE.md) and [architecture decisions](docs/DECISIONS.md)
- [Game Development](docs/GAME_DEVELOPMENT.md) and [Testing](docs/TESTING.md)
- [Deployment](docs/DEPLOYMENT.md), [Operations](docs/OPERATIONS.md), and [Cost](docs/COST.md)
- [Security and Privacy](docs/SECURITY.md)
- [Interview Brief](docs/INTERVIEW_BRIEF.md) and [Learning Notes](docs/LEARNING_NOTES.md)

# Game Development

A game is an isolated rules module. It owns typed authoritative state, validates player commands, computes transitions, and projects only viewer-safe state. It does not open sockets, address Durable Objects, read globals, or render React.

## Recommended module layout

```text
src/games/<game-id>/
  contract.ts       State, Command, and PublicState types
  game.ts           GameDefinition implementation
  game.test.ts      deterministic rule tests
  ui/               optional React presentation
  index.ts          public exports and metadata registration
```

Keep imports flowing inward: UI and room adapters may import the game module; game rules may import only shared contracts and local helpers.

## Define the contract

```ts
import type { GameDefinition } from "../../shared/game-contract";

type State = { readonly total: number; readonly winner?: string };
type Command = { readonly type: "add"; readonly amount: number };
type PublicState = { readonly total: number; readonly finished: boolean };

export const exampleGame: GameDefinition<State, Command, PublicState> = {
  metadata: {
    id: "example",
    name: "Example",
    description: "A contract example, not a shipped game.",
    minimumPlayers: 2,
    maximumPlayers: 4,
  },

  createInitialState: () => ({ total: 0 }),

  validateCommand: (value: unknown): value is Command => {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as Record<string, unknown>;
    return candidate.type === "add" &&
      typeof candidate.amount === "number" &&
      Number.isSafeInteger(candidate.amount) &&
      candidate.amount > 0;
  },

  applyCommand: (state, command) => {
    if (state.winner !== undefined) return { accepted: false, reason: "Game is finished." };
    return { accepted: true, state: { ...state, total: state.total + command.amount } };
  },

  projectState: (state) => ({ total: state.total, finished: state.winner !== undefined }),
};
```

The assertion in this documentation example follows a preceding object/null check. Production validators may use small reusable guards, but must not use `any`, trust browser payloads, or double-cast values.

## Rules for authoritative games

1. **Commands express intent.** Send `play card X`, not `my score is 10`.
2. **Validate at runtime.** TypeScript disappears at the network boundary.
3. **Keep transitions deterministic.** Pass time through `GameContext`; introduce a seeded random source through the contract when the first random game needs it.
4. **Do not leak state.** `projectState(state, viewer)` must hide hands, answers, and private roles.
5. **Return rejection, do not throw, for legal user mistakes.** Exceptions indicate programmer or infrastructure failure.
6. **Persist accepted state before broadcast.** Acknowledgement must never get ahead of durable truth.
7. **Test rules without Cloudflare.** Most game behavior should be fast, pure Vitest tests.

## Register discovery metadata

Add the module's metadata in `src/games/registry.ts`. The registry currently powers discovery only. Do not add a global mutable game session there. The first real game will establish the typed room-runtime adapter using the concrete needs learned from that game.

## Protocol changes

Prefer the existing `game:command` and `game:state` envelopes; game-specific payloads belong inside `command` and `state`. If a new platform-level message is required:

1. Add it to the appropriate discriminated union in `src/shared/protocol.ts`.
2. Extend runtime parsing for every new client message.
3. Add accepted and rejected parser tests.
4. Keep old clients working when possible. Increment `PROTOCOL_VERSION` only for a breaking change and document rollout behavior.

## Definition of done for a game

- Metadata and typed `GameDefinition` exist.
- Runtime validators cover every command variant and bound strings/numbers/arrays.
- Rule tests cover happy paths, illegal turns, duplicate commands, terminal state, and private projections.
- The room adapter persists accepted revisions and can restore after restart/hibernation.
- Client UI handles reconnect, stale revisions, server rejection, and accessibility states.
- `npm run check` and `npm run deploy:dry-run` pass.
- Architecture docs are updated if the game requires a new platform capability.

Following this shape keeps game 11 additive: one module, explicit registration, tests, and UI—without another service or deployment.

# Client Game Framework

The browser shell discovers game presentation modules at build time. A new game does not add a route, edit the shell, or register itself in a central client file.

## Add game #11

Create `src/client/games/<game-id>/index.tsx` and export one default `ClientGameModule`:

```tsx
import type { ClientGameModule, GameViewProps } from "../../game-framework/types";

function ExampleView({ roomId, playerName, onFinish }: GameViewProps) {
  return (
    <section aria-labelledby="example-title">
      <p>Room {roomId}</p>
      <h1 id="example-title">Your turn, {playerName}</h1>
      {/* Render viewer-safe state and send player intents through the game adapter. */}
      <button type="button" onClick={onFinish}>Finish round</button>
    </section>
  );
}

const game: ClientGameModule = {
  metadata: {
    id: "example",
    name: "Example",
    description: "Longer rules-oriented description.",
    shortDescription: "One sentence for the catalog card.",
    minimumPlayers: 1,
    maximumPlayers: 4,
    estimatedMinutes: 8,
    accent: "mint",
    icon: "E",
    supportsSolo: true,
  },
  View: ExampleView,
};

export default game;
```

`src/client/game-framework/catalog.ts` uses Vite's eager `import.meta.glob("../games/*/index.tsx")`. It validates duplicate IDs, sorts cards by name, and exposes `clientGames`, `getClientGame`, and `getGameMetadata`. The generic `/game/:roomId` route resolves the active view from the room snapshot's `gameId`; no game-specific route is needed.

Keep the client metadata ID identical to the authoritative `GameDefinition.metadata.id` in `src/games/<game-id>`. The Worker registry remains the source of truth for game rules and valid player counts. Client metadata controls presentation only.

## View boundary

`GameViewProps` deliberately contains only shell context:

- `gameId`: the selected authoritative game ID.
- `roomId`: the current room.
- `playerName`: the local display name.
- `onFinish`: asks the shell to transition to results after the authoritative game reports completion.

Game views must not create rooms, implement lobby presence, navigate to results directly, or calculate trusted session scores. Those responsibilities remain in the shared room transport and authoritative Worker. Replace the temporary `PracticeGameView` for each shipped game with a game-specific view and adapter that sends typed player intents and renders only viewer-safe projections.

## Shared shell contracts

The shell consumes `RoomTransport` from `src/client/room/transport.ts` for create, join, subscribe, settings, phase changes, rematch, and leave. Tests inject `MockRoomTransport`; production supplies a WebSocket/HTTP adapter without changing screens or game modules.

Generic routes are:

- `/`
- `/create` and `/create?mode=solo`
- `/join` and `/join/:roomId`
- `/lobby/:roomId`
- `/game/:roomId`
- `/results/:roomId`

Games may import shared layout primitives and design tokens but must keep game-specific components and styles inside their own directory. Do not edit `App.tsx`, `router.tsx`, `catalog.ts`, or global CSS merely to register a game.

## Accessibility and responsive acceptance

A game module is complete when:

1. Every critical control is keyboard operable, visibly focused, and at least 44px in its smallest dimension or adequately spaced.
2. Status, turn, validation, and completion changes have semantic text and do not rely on color alone.
3. The view fits at 320px without horizontal scrolling and remains usable through desktop widths.
4. Rules/help are available without hover-only interaction.
5. Component tests cover core interaction and an axe scan; game rules remain separately tested as pure authoritative logic.
6. `src/client/game-framework/catalog.test.ts` discovers the module with a unique ID.
7. `npm run check` and `npm run deploy:dry-run` pass.

A jsdom width assignment is only a structural check. Use a real browser at 320px and a representative desktop viewport before declaring layout and overflow verified.

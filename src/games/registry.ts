import type { GameId, GameMetadata } from "../shared/game-contract";

/** Discovery registry. Runtime game factories are intentionally added with the first game. */
export class GameRegistry {
  readonly #games = new Map<GameId, GameMetadata>();

  register(metadata: GameMetadata): void {
    if (this.#games.has(metadata.id)) {
      throw new Error(`Game '${metadata.id}' is already registered.`);
    }
    this.#games.set(metadata.id, metadata);
  }

  get(gameId: GameId): GameMetadata | undefined {
    return this.#games.get(gameId);
  }

  list(): readonly GameMetadata[] {
    return [...this.#games.values()];
  }
}

/** Add game metadata here as modules are implemented. */
export const gameRegistry = new GameRegistry();

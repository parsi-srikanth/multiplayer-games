import type { ClientGameModule, ClientGameMetadata } from "./types";

const discovered = import.meta.glob<{ default: ClientGameModule }>(
  "../games/*/index.tsx",
  { eager: true },
);

function buildCatalog(): readonly ClientGameModule[] {
  const modules = Object.values(discovered).map((module) => module.default);

  const ids = new Set<string>();
  for (const game of modules) {
    if (ids.has(game.metadata.id)) {
      throw new Error(`Duplicate client game '${game.metadata.id}'.`);
    }
    ids.add(game.metadata.id);
  }

  return modules.sort((left, right) => left.metadata.name.localeCompare(right.metadata.name));
}

export const clientGames = buildCatalog();

export function getClientGame(gameId: string): ClientGameModule | undefined {
  return clientGames.find((game) => game.metadata.id === gameId);
}

export function getGameMetadata(gameId: string): ClientGameMetadata | undefined {
  return getClientGame(gameId)?.metadata;
}

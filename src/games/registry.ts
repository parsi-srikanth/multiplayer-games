import type { GameDefinition, GameId, GameMetadata, PlayerId, PlayerView } from "../shared/game-contract";
import { cowsBullsChallenge } from "./cows-bulls-challenge";
import { cowsBullsClassic } from "./cows-bulls-classic";
import { wordRace } from "./word-race";
import { ticTacToePlus } from "./tic-tac-toe-plus";
import { dotsBoxes } from "./dots-boxes";
import { connectFour } from "./connect-four";
import { sudokuSprint } from "./sudoku-sprint";

export interface RuntimeGame {
  readonly metadata: GameMetadata;
  createInitialState(players: readonly PlayerView[], roomId: string, now: number): unknown;
  applyCommand(state: unknown, command: unknown, actor: PlayerId, roomId: string, now: number):
    | { readonly accepted: true; readonly state: unknown }
    | { readonly accepted: false; readonly reason: string };
  projectState(state: unknown, viewer: PlayerId): unknown;
  isComplete(state: unknown): boolean;
  scores(state: unknown): Readonly<Record<PlayerId, number>>;
}

/** Runtime registry keeps unsafe state casts inside the typed registration adapter. */
export class GameRegistry {
  readonly #games = new Map<GameId, RuntimeGame>();

  register<State, Command, PublicState>(definition: GameDefinition<State, Command, PublicState>): void {
    if (this.#games.has(definition.metadata.id)) throw new Error(`Game '${definition.metadata.id}' is already registered.`);
    this.#games.set(definition.metadata.id, {
      metadata: definition.metadata,
      createInitialState: (players, roomId, now) => definition.createInitialState(players, { roomId, now }),
      applyCommand: (state, command, actor, roomId, now) => {
        if (!definition.validateCommand(command)) return { accepted: false, reason: "Invalid game command." };
        return definition.applyCommand(state as State, command, actor, { roomId, now });
      },
      projectState: (state, viewer) => definition.projectState(state as State, viewer),
      isComplete: (state) => definition.isComplete?.(state as Readonly<State>) ?? false,
      scores: (state) => definition.getScores?.(state as Readonly<State>) ?? {},
    });
  }

  get(gameId: GameId): RuntimeGame | undefined { return this.#games.get(gameId); }
  list(): readonly GameMetadata[] { return [...this.#games.values()].map((game) => game.metadata); }
}

export const gameRegistry = new GameRegistry();
gameRegistry.register(cowsBullsChallenge);
gameRegistry.register(cowsBullsClassic);
gameRegistry.register(wordRace);
gameRegistry.register(ticTacToePlus);
gameRegistry.register(dotsBoxes);
gameRegistry.register(connectFour);
gameRegistry.register(sudokuSprint);

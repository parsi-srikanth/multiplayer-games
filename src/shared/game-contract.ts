export const PROTOCOL_VERSION = 1 as const;

export type PlayerId = string;
export type RoomId = string;
export type GameId = string;

export interface GameMetadata {
  readonly id: GameId;
  readonly name: string;
  readonly description: string;
  readonly minimumPlayers: number;
  readonly maximumPlayers: number;
}

export interface PlayerView {
  readonly id: PlayerId;
  readonly displayName: string;
}

export interface GameContext {
  readonly roomId: RoomId;
  readonly now: number;
}

export type GameTransition<State> =
  | { readonly accepted: true; readonly state: State }
  | { readonly accepted: false; readonly reason: string };

/**
 * Server-only rules for one game. State is authoritative and never sent directly;
 * projectState must explicitly create a player-safe representation.
 */
export interface GameDefinition<State, Command, PublicState> {
  readonly metadata: GameMetadata;
  createInitialState(players: readonly PlayerView[], context: GameContext): State;
  validateCommand(value: unknown): value is Command;
  applyCommand(
    state: Readonly<State>,
    command: Command,
    actor: PlayerId,
    context: GameContext,
  ): GameTransition<State>;
  projectState(state: Readonly<State>, viewer: PlayerId): PublicState;
  /** Required by the authoritative room runtime to derive results without trusting clients. */
  isComplete?(state: Readonly<State>): boolean;
  getScores?(state: Readonly<State>): Readonly<Record<PlayerId, number>>;
}

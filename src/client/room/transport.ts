import { CloudflareRoomTransport } from "./cloudflare-transport";
import { gameRegistry } from "../../games/registry";

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "offline";
export type RoomPhase = "lobby" | "playing" | "results";

export interface RoomPlayer {
  readonly id: string;
  readonly displayName: string;
  readonly connected: boolean;
  readonly score: number;
}

export interface RoomSnapshot {
  readonly id: string;
  readonly hostId: string;
  readonly localPlayerId: string;
  readonly players: readonly RoomPlayer[];
  readonly gameId: string;
  readonly rounds: number;
  readonly phase: RoomPhase;
  readonly connection: ConnectionStatus;
  readonly gameState: unknown;
  readonly revision: number;
}

export interface CreateRoomInput {
  readonly displayName: string;
  readonly gameId: string;
  readonly solo?: boolean;
}

export interface JoinRoomInput {
  readonly roomId: string;
  readonly displayName: string;
}

export interface RoomTransport {
  createRoom(input: CreateRoomInput): Promise<RoomSnapshot>;
  joinRoom(input: JoinRoomInput): Promise<RoomSnapshot>;
  getSnapshot(roomId: string): RoomSnapshot | undefined;
  subscribe(roomId: string, listener: (snapshot: RoomSnapshot) => void): () => void;
  updateSettings(roomId: string, gameId: string, rounds: number): Promise<void>;
  setPhase(roomId: string, phase: RoomPhase): Promise<void>;
  rematch(roomId: string): Promise<void>;
  sendGameCommand(roomId: string, command: unknown): Promise<void>;
  leave(roomId: string): Promise<void>;
}

const DEFAULT_ROOM_ID = "PLAY-42";

function normalizeRoomId(roomId: string): string {
  return roomId.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

export class MockRoomTransport implements RoomTransport {
  readonly #rooms = new Map<string, RoomSnapshot>();
  readonly #listeners = new Map<string, Set<(snapshot: RoomSnapshot) => void>>();
  readonly #gameStates = new Map<string, unknown>();

  createRoom(input: CreateRoomInput): Promise<RoomSnapshot> {
    const roomId = DEFAULT_ROOM_ID;
    const playerId = "player-host";
    const snapshot: RoomSnapshot = {
      id: roomId,
      hostId: playerId,
      localPlayerId: playerId,
      players: [
        { id: playerId, displayName: input.displayName, connected: true, score: 3 },
      ],
      gameId: input.gameId,
      rounds: 3,
      phase: "lobby",
      connection: "connected",
      gameState: null,
      revision: 0,
    };
    this.#rooms.set(roomId, snapshot);
    this.#emit(snapshot);
    return Promise.resolve(snapshot);
  }

  joinRoom(input: JoinRoomInput): Promise<RoomSnapshot> {
    const roomId = normalizeRoomId(input.roomId);
    if (roomId.length < 4) return Promise.reject(new Error("Enter a room code with at least 4 characters."));
    const localPlayerId = "player-guest";
    const snapshot: RoomSnapshot = {
      id: roomId,
      hostId: "player-host",
      localPlayerId,
      players: [
        { id: "player-host", displayName: "Maya", connected: true, score: 5 },
        { id: localPlayerId, displayName: input.displayName, connected: true, score: 3 },
        { id: "player-friend", displayName: "Noah", connected: false, score: 2 },
      ],
      gameId: "tic-tac-toe-plus",
      rounds: 3,
      phase: "lobby",
      connection: "connected",
      gameState: null,
      revision: 0,
    };
    this.#rooms.set(roomId, snapshot);
    this.#emit(snapshot);
    return Promise.resolve(snapshot);
  }

  getSnapshot(roomId: string): RoomSnapshot | undefined {
    return this.#rooms.get(normalizeRoomId(roomId));
  }

  subscribe(roomId: string, listener: (snapshot: RoomSnapshot) => void): () => void {
    const normalizedId = normalizeRoomId(roomId);
    const listeners = this.#listeners.get(normalizedId) ?? new Set();
    listeners.add(listener);
    this.#listeners.set(normalizedId, listeners);
    const snapshot = this.#rooms.get(normalizedId);
    if (snapshot !== undefined) listener(snapshot);
    return () => {
      listeners.delete(listener);
    };
  }

  updateSettings(roomId: string, gameId: string, rounds: number): Promise<void> {
    this.#update(roomId, (snapshot) => ({ ...snapshot, gameId, rounds }));
    return Promise.resolve();
  }

  setPhase(roomId: string, phase: RoomPhase): Promise<void> {
    if (phase === "playing") {
      const snapshot = this.getSnapshot(roomId);
      if (snapshot === undefined) return Promise.reject(new Error("Room not found."));
      const game = gameRegistry.get(snapshot.gameId);
      if (game !== undefined) {
        if (snapshot.players.length < game.metadata.minimumPlayers || snapshot.players.length > game.metadata.maximumPlayers)
          return Promise.reject(new Error(`This game requires ${String(game.metadata.minimumPlayers)}–${String(game.metadata.maximumPlayers)} players.`));
        const state = game.createInitialState(snapshot.players.map((player) => ({ id: player.id, displayName: player.displayName })), snapshot.id, Date.now());
        this.#gameStates.set(snapshot.id, state);
        this.#update(roomId, (room) => ({ ...room, phase, gameState: game.projectState(state, room.localPlayerId) }));
        return Promise.resolve();
      }
    }
    this.#update(roomId, (snapshot) => ({ ...snapshot, phase }));
    return Promise.resolve();
  }

  rematch(roomId: string): Promise<void> {
    return this.setPhase(roomId, "playing");
  }

  sendGameCommand(roomId: string, command: unknown): Promise<void> {
    const snapshot = this.getSnapshot(roomId);
    if (snapshot === undefined) return Promise.reject(new Error("Room not found."));
    const game = gameRegistry.get(snapshot.gameId);
    const state = this.#gameStates.get(snapshot.id);
    if (game === undefined || state === undefined) {
      this.#update(roomId, (room) => ({ ...room, gameState: command }));
      return Promise.resolve();
    }
    const transition = game.applyCommand(state, command, snapshot.localPlayerId, snapshot.id, Date.now());
    if (!transition.accepted) return Promise.reject(new Error(transition.reason));
    this.#gameStates.set(snapshot.id, transition.state);
    const complete = game.isComplete(transition.state);
    const scores = complete ? game.scores(transition.state) : {};
    this.#update(roomId, (room) => ({ ...room, phase: complete ? "results" : "playing",
      gameState: game.projectState(transition.state, room.localPlayerId),
      players: room.players.map((player) => ({ ...player, score: scores[player.id] ?? player.score })) }));
    return Promise.resolve();
  }

  leave(roomId: string): Promise<void> {
    const normalized = normalizeRoomId(roomId);
    this.#rooms.delete(normalized);
    this.#gameStates.delete(normalized);
    return Promise.resolve();
  }

  #update(roomId: string, updater: (snapshot: RoomSnapshot) => RoomSnapshot): void {
    const normalizedId = normalizeRoomId(roomId);
    const snapshot = this.#rooms.get(normalizedId);
    if (snapshot === undefined) throw new Error("Room not found.");
    const updated = { ...updater(snapshot), revision: snapshot.revision + 1 };
    this.#rooms.set(normalizedId, updated);
    this.#emit(updated);
  }

  #emit(snapshot: RoomSnapshot): void {
    this.#listeners.get(snapshot.id)?.forEach((listener) => {
      listener(snapshot);
    });
  }
}

/** Uses in-memory state for solo practice and the Cloudflare Worker for multiplayer rooms. */
export class HybridRoomTransport implements RoomTransport {
  readonly #solo = new MockRoomTransport();
  readonly #multiplayer = new CloudflareRoomTransport();
  readonly #soloRoomIds = new Set<string>();

  async createRoom(input: CreateRoomInput): Promise<RoomSnapshot> {
    if (input.solo === true) {
      const room = await this.#solo.createRoom(input);
      this.#soloRoomIds.add(room.id);
      return room;
    }
    return this.#multiplayer.createRoom(input);
  }
  joinRoom(input: JoinRoomInput): Promise<RoomSnapshot> { return this.#multiplayer.joinRoom(input); }
  getSnapshot(roomId: string): RoomSnapshot | undefined { return this.#transport(roomId).getSnapshot(roomId); }
  subscribe(roomId: string, listener: (snapshot: RoomSnapshot) => void): () => void {
    return this.#transport(roomId).subscribe(roomId, listener);
  }
  updateSettings(roomId: string, gameId: string, rounds: number): Promise<void> {
    return this.#transport(roomId).updateSettings(roomId, gameId, rounds);
  }
  setPhase(roomId: string, phase: RoomPhase): Promise<void> { return this.#transport(roomId).setPhase(roomId, phase); }
  rematch(roomId: string): Promise<void> { return this.#transport(roomId).rematch(roomId); }
  sendGameCommand(roomId: string, command: unknown): Promise<void> { return this.#transport(roomId).sendGameCommand(roomId, command); }
  async leave(roomId: string): Promise<void> {
    await this.#transport(roomId).leave(roomId);
    this.#soloRoomIds.delete(roomId);
  }
  #transport(roomId: string): RoomTransport { return this.#soloRoomIds.has(roomId) ? this.#solo : this.#multiplayer; }
}

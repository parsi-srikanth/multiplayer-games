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
}

export interface CreateRoomInput {
  readonly displayName: string;
  readonly gameId: string;
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
  leave(roomId: string): Promise<void>;
}

const DEFAULT_ROOM_ID = "PLAY-42";

function normalizeRoomId(roomId: string): string {
  return roomId.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

export class MockRoomTransport implements RoomTransport {
  readonly #rooms = new Map<string, RoomSnapshot>();
  readonly #listeners = new Map<string, Set<(snapshot: RoomSnapshot) => void>>();

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
      gameId: "tic-tac-toe",
      rounds: 3,
      phase: "lobby",
      connection: "connected",
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
    this.#update(roomId, (snapshot) => ({ ...snapshot, phase }));
    return Promise.resolve();
  }

  rematch(roomId: string): Promise<void> {
    return this.setPhase(roomId, "lobby");
  }

  leave(roomId: string): Promise<void> {
    this.#rooms.delete(normalizeRoomId(roomId));
    return Promise.resolve();
  }

  #update(roomId: string, updater: (snapshot: RoomSnapshot) => RoomSnapshot): void {
    const normalizedId = normalizeRoomId(roomId);
    const snapshot = this.#rooms.get(normalizedId);
    if (snapshot === undefined) throw new Error("Room not found.");
    const updated = updater(snapshot);
    this.#rooms.set(normalizedId, updated);
    this.#emit(updated);
  }

  #emit(snapshot: RoomSnapshot): void {
    this.#listeners.get(snapshot.id)?.forEach((listener) => {
      listener(snapshot);
    });
  }
}

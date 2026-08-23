import { PROTOCOL_VERSION } from "../../shared/game-contract";
import type { ClientMessage, RoomProjection, ServerMessage } from "../../shared/protocol";
import type { CreateRoomInput, JoinRoomInput, RoomSnapshot, RoomTransport } from "./transport";

const RECONNECT_PREFIX = "parsi-games-reconnect:";
const DISPLAY_NAME_KEY = "parsi-games-display-name";
const RESPONSE_TIMEOUT_MS = 10_000;

interface SnapshotWaiter {
  readonly predicate: (snapshot: RoomSnapshot) => boolean;
  readonly resolve: (snapshot: RoomSnapshot) => void;
  readonly reject: (reason: Error) => void;
  readonly timeout: ReturnType<typeof setTimeout>;
}

interface Connection {
  readonly code: string;
  displayName: string;
  socket?: WebSocket;
  snapshot?: RoomSnapshot;
  playerId?: string;
  reconnectToken?: string;
  readonly listeners: Set<(snapshot: RoomSnapshot) => void>;
  readonly waiters: Set<SnapshotWaiter>;
  reconnectAttempt: number;
  intentionallyClosed: boolean;
}

function normalizeRoomId(roomId: string): string {
  return roomId.trim().toUpperCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseServerMessage(data: unknown): ServerMessage | undefined {
  if (typeof data !== "string") return undefined;
  try {
    const value = JSON.parse(data) as unknown;
    return isRecord(value) && typeof value.type === "string" ? value as unknown as ServerMessage : undefined;
  } catch { return undefined; }
}

function websocketUrl(code: string): string {
  const url = new URL(`/api/rooms/${code}/connect`, window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

function toSnapshot(room: RoomProjection): RoomSnapshot {
  return {
    id: room.code,
    hostId: room.players.find((player) => player.isHost)?.id ?? "",
    localPlayerId: room.viewer.playerId,
    players: room.players.map((player) => ({
      id: player.id,
      displayName: player.displayName,
      connected: player.presence === "connected",
      score: player.sessionScore,
    })),
    gameId: room.selectedGameId ?? "",
    rounds: 1,
    phase: room.phase === "starting" ? "playing" : room.phase,
    connection: "connected",
    gameState: room.game,
    revision: room.revision,
  };
}

export class CloudflareRoomTransport implements RoomTransport {
  readonly #connections = new Map<string, Connection>();

  async createRoom(input: CreateRoomInput): Promise<RoomSnapshot> {
    const response = await fetch("/api/rooms", { method: "POST", headers: { Accept: "application/json" } });
    const body = await response.json().catch(() => undefined) as unknown;
    if (!response.ok || !isRecord(body) || typeof body.code !== "string") {
      throw new Error(isRecord(body) && typeof body.error === "string" ? body.error : "Could not create a multiplayer room.");
    }
    const snapshot = await this.#connect(body.code, input.displayName);
    await this.updateSettings(snapshot.id, input.gameId);
    return this.#requiredConnection(snapshot.id).snapshot ?? snapshot;
  }

  joinRoom(input: JoinRoomInput): Promise<RoomSnapshot> {
    const code = normalizeRoomId(input.roomId);
    if (!/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$/.test(code)) return Promise.reject(new Error("Enter a valid five-character room code."));
    return this.#connect(code, input.displayName);
  }

  getSnapshot(roomId: string): RoomSnapshot | undefined {
    return this.#connections.get(normalizeRoomId(roomId))?.snapshot;
  }

  subscribe(roomId: string, listener: (snapshot: RoomSnapshot) => void): () => void {
    const code = normalizeRoomId(roomId);
    let connection = this.#connections.get(code);
    if (connection === undefined) {
      const displayName = localStorage.getItem(DISPLAY_NAME_KEY)?.trim();
      const reconnectToken = localStorage.getItem(`${RECONNECT_PREFIX}${code}`) ?? undefined;
      if (displayName !== undefined && displayName !== "" && reconnectToken !== undefined) {
        connection = this.#newConnection(code, displayName, reconnectToken);
        this.#connections.set(code, connection);
        const reconnecting = connection;
        void this.#open(reconnecting).catch(() => { this.#setConnectionStatus(reconnecting, "offline"); });
      }
    }
    connection?.listeners.add(listener);
    if (connection?.snapshot !== undefined) listener(connection.snapshot);
    return () => { connection?.listeners.delete(listener); };
  }

  async updateSettings(roomId: string, gameId: string): Promise<void> {
    await this.#sendAndWait(roomId, { type: "room:select_game", gameId }, (snapshot) => snapshot.gameId === gameId);
  }

  async setPhase(roomId: string, phase: RoomSnapshot["phase"]): Promise<void> {
    if (phase === "playing") {
      await this.#sendAndWait(roomId, { type: "room:start" }, (snapshot) => snapshot.phase === "playing" || snapshot.phase === "results");
      return;
    }
    if (phase === "lobby") {
      await this.#sendAndWait(roomId, { type: "room:return_lobby" }, (snapshot) => snapshot.phase === "lobby");
      return;
    }
    throw new Error("Game completion is determined by the authoritative server.");
  }

  async rematch(roomId: string): Promise<void> {
    await this.#sendAndWait(roomId, { type: "room:rematch" }, (snapshot) => snapshot.phase === "playing");
  }

  async sendGameCommand(roomId: string, command: unknown): Promise<void> {
    await this.#sendAndWait(roomId, { type: "game:command", command }, () => true);
  }

  leave(roomId: string): Promise<void> {
    const connection = this.#requiredConnection(roomId);
    connection.intentionallyClosed = true;
    localStorage.removeItem(`${RECONNECT_PREFIX}${connection.code}`);
    this.#send(connection, { type: "room:leave" });
    this.#connections.delete(connection.code);
    return Promise.resolve();
  }

  #newConnection(code: string, displayName: string, reconnectToken?: string): Connection {
    return { code, displayName, ...(reconnectToken === undefined ? {} : { reconnectToken }), listeners: new Set(), waiters: new Set(), reconnectAttempt: 0, intentionallyClosed: false };
  }

  async #connect(rawCode: string, displayName: string): Promise<RoomSnapshot> {
    const code = normalizeRoomId(rawCode);
    const prior = this.#connections.get(code);
    if (prior !== undefined) {
      prior.intentionallyClosed = true;
      prior.socket?.close(1000, "Opening replacement connection");
    }
    const reconnectToken = localStorage.getItem(`${RECONNECT_PREFIX}${code}`) ?? undefined;
    const connection = this.#newConnection(code, displayName, reconnectToken);
    this.#connections.set(code, connection);
    return this.#open(connection);
  }

  #open(connection: Connection): Promise<RoomSnapshot> {
    this.#setConnectionStatus(connection, connection.snapshot === undefined ? "connecting" : "reconnecting");
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(websocketUrl(connection.code));
      connection.socket = socket;
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) { settled = true; socket.close(); reject(new Error("Room connection timed out.")); }
      }, RESPONSE_TIMEOUT_MS);
      socket.addEventListener("open", () => {
        this.#send(connection, {
          type: "client:hello",
          protocolVersion: PROTOCOL_VERSION,
          displayName: connection.displayName,
          ...(connection.reconnectToken === undefined ? {} : { reconnectToken: connection.reconnectToken }),
        });
      });
      socket.addEventListener("message", (event) => {
        const message = parseServerMessage(event.data);
        if (message === undefined) return;
        if (message.type === "server:hello") {
          connection.playerId = message.playerId;
          connection.reconnectToken = message.reconnectToken;
          localStorage.setItem(`${RECONNECT_PREFIX}${connection.code}`, message.reconnectToken);
          return;
        }
        if (message.type === "server:error") {
          if (message.code === "not_admitted" && connection.reconnectToken !== undefined) {
            delete connection.reconnectToken;
            localStorage.removeItem(`${RECONNECT_PREFIX}${connection.code}`);
          }
          this.#rejectWaiters(connection, new Error(message.message));
          if (!settled) { settled = true; clearTimeout(timeout); reject(new Error(message.message)); }
          return;
        }
        if (message.type === "room:state") {
          connection.snapshot = toSnapshot(message.room);
          connection.reconnectAttempt = 0;
          this.#emit(connection);
          if (!settled) { settled = true; clearTimeout(timeout); resolve(connection.snapshot); }
        }
      });
      socket.addEventListener("error", () => {
        if (!settled) { settled = true; clearTimeout(timeout); reject(new Error("Could not connect to the multiplayer room.")); }
      });
      socket.addEventListener("close", (event) => {
        clearTimeout(timeout);
        if (!settled) { settled = true; reject(new Error(event.reason || "Room connection closed.")); }
        if (connection.intentionallyClosed || event.code === 1000 || event.code === 4001 || event.code === 1008) {
          this.#setConnectionStatus(connection, "offline");
          return;
        }
        this.#setConnectionStatus(connection, "reconnecting");
        const delay = Math.min(10_000, 1_000 * 2 ** connection.reconnectAttempt);
        connection.reconnectAttempt += 1;
        setTimeout(() => {
          if (!connection.intentionallyClosed && connection.socket === socket) {
            void this.#open(connection).catch(() => { /* close handler schedules the bounded retry */ });
          }
        }, delay);
      });
    });
  }

  #send(connection: Connection, message: ClientMessage): void {
    if (connection.socket?.readyState !== WebSocket.OPEN) throw new Error("Room is not connected.");
    connection.socket.send(JSON.stringify(message));
  }

  async #sendAndWait(roomId: string, message: ClientMessage, predicate: (snapshot: RoomSnapshot) => boolean): Promise<void> {
    const connection = this.#requiredConnection(roomId);
    const priorRevision = connection.snapshot?.revision ?? -1;
    this.#send(connection, message);
    const response = new Promise<RoomSnapshot>((resolve, reject) => {
      const waiter: SnapshotWaiter = {
        predicate: (snapshot) => snapshot.revision > priorRevision && predicate(snapshot),
        resolve,
        reject,
        timeout: setTimeout(() => { connection.waiters.delete(waiter); reject(new Error("The room did not confirm this action.")); }, RESPONSE_TIMEOUT_MS),
      };
      connection.waiters.add(waiter);
    });
    await response;
  }

  #requiredConnection(roomId: string): Connection {
    const connection = this.#connections.get(normalizeRoomId(roomId));
    if (connection === undefined) throw new Error("Room is not connected.");
    return connection;
  }

  #emit(connection: Connection): void {
    const snapshot = connection.snapshot;
    if (snapshot === undefined) return;
    for (const listener of connection.listeners) listener(snapshot);
    for (const waiter of [...connection.waiters]) {
      if (!waiter.predicate(snapshot)) continue;
      clearTimeout(waiter.timeout);
      connection.waiters.delete(waiter);
      waiter.resolve(snapshot);
    }
  }

  #rejectWaiters(connection: Connection, reason: Error): void {
    for (const waiter of connection.waiters) {
      clearTimeout(waiter.timeout);
      waiter.reject(reason);
    }
    connection.waiters.clear();
  }

  #setConnectionStatus(connection: Connection, status: RoomSnapshot["connection"]): void {
    if (connection.snapshot === undefined || connection.snapshot.connection === status) return;
    connection.snapshot = { ...connection.snapshot, connection: status };
    this.#emit(connection);
  }
}

import { DurableObject } from "cloudflare:workers";
import { PROTOCOL_VERSION } from "../shared/game-contract";
import { isClientMessageWithinLimit, parseClientMessage, serializeServerMessage } from "../shared/protocol";
import type { ServerErrorMessage } from "../shared/protocol";
import { admitPlayer, applyRoomMessage, createRoomState, disconnectPlayer, expireDisconnectedPlayers,
  gameProjectionFor, isRoomExpired, MAX_ROOM_SNAPSHOT_BYTES, projectRoom, reconnectPlayer,
  RECONNECT_GRACE_MS, ROOM_STATE_SCHEMA_VERSION, roomExpiresAt, sanitizeDisplayName } from "./room-engine";
import type { PlayerState, RoomState } from "./room-engine";

const RATE_WINDOW_MS = 10_000;
const SOCKET_RATE_LIMIT = 30;
const ROOM_RATE_LIMIT = 120;
const MAX_ROOM_SOCKETS = 8;
const PRE_ADMISSION_TIMEOUT_MS = 30_000;
interface SessionAttachment {
  playerId: string | null;
  roomId: string;
  connectedAt: number;
  rateWindowStartedAt: number;
  rateCount: number;
  replaced?: boolean;
}
function errorMessage(code: ServerErrorMessage["code"], message: string): string {
  return serializeServerMessage({ type: "server:error", code, message });
}
function encodeToken(bytes: Uint8Array): string {
  let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function hashToken(token: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return encodeToken(new Uint8Array(hash));
}
function newReconnectToken(): string { const bytes = new Uint8Array(32); crypto.getRandomValues(bytes); return encodeToken(bytes); }
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isPlayerState(value: unknown): value is PlayerState {
  return isRecord(value) && typeof value.id === "string" && typeof value.displayName === "string" &&
    typeof value.tokenHash === "string" && typeof value.joinedAt === "number" && typeof value.connected === "boolean" &&
    (value.disconnectedAt === null || typeof value.disconnectedAt === "number") &&
    Number.isSafeInteger(value.gameScore) && Number.isSafeInteger(value.sessionScore);
}
function isRoomState(value: unknown): value is RoomState {
  if (!isRecord(value) || value.schemaVersion !== ROOM_STATE_SCHEMA_VERSION || typeof value.code !== "string" ||
      !/^[A-Z2-9]{5}$/.test(value.code) || !["lobby", "starting", "playing", "results"].includes(String(value.phase)) ||
      !Number.isSafeInteger(value.revision) || (value.hostId !== null && typeof value.hostId !== "string") ||
      (value.selectedGameId !== null && typeof value.selectedGameId !== "string") || !Number.isFinite(value.createdAt) ||
      !Number.isFinite(value.updatedAt) || !Array.isArray(value.players) || value.players.length > 4 ||
      !value.players.every(isPlayerState) || (value.results !== null && !Array.isArray(value.results))) return false;
  return value.hostId === null || value.players.some((player) => player.id === value.hostId);
}

export class RoomDurableObject extends DurableObject<Env> {
  private roomRateWindowStartedAt = Date.now();
  private roomRateCount = 0;

  private ensureSchema(): void {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS room_state (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        state_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      ) STRICT;
    `);
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/_create") && request.method === "POST") {
      this.ensureSchema();
      const code = request.headers.get("X-Room-ID");
      if (code === null) return Response.json({ error: "Room context missing" }, { status: 400 });
      const existing = this.loadState();
      if (existing !== undefined && !isRoomExpired(existing, Date.now())) return Response.json({ error: "Room already exists" }, { status: 409 });
      if (existing !== undefined) await this.expireRoom();
      const state = createRoomState(code, Date.now());
      try { await this.persistAndSchedule(state); }
      catch { return Response.json({ error: "Room capacity is temporarily unavailable" }, { status: 503 }); }
      return Response.json({ code }, { status: 201 });
    }
    if (url.pathname.endsWith("/_info") && request.method === "GET") {
      const state = this.loadState();
      if (state === undefined) return Response.json({ error: "Room not found" }, { status: 404 });
      if (isRoomExpired(state, Date.now())) { await this.expireRoom(); return Response.json({ error: "Room expired" }, { status: 404 }); }
      return Response.json({ code: state.code, phase: state.phase, selectedGameId: state.selectedGameId,
        playerCount: state.players.length, capacity: 4, joinable: state.phase === "lobby" && state.players.length < 4 });
    }
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket")
      return Response.json({ error: "WebSocket upgrade required" }, { status: 426 });
    const roomId = request.headers.get("X-Room-ID");
    if (roomId === null) return Response.json({ error: "Room context missing" }, { status: 400 });
    const state = this.loadState();
    if (state === undefined) return Response.json({ error: "Room not found" }, { status: 404 });
    if (isRoomExpired(state, Date.now())) { await this.expireRoom(); return Response.json({ error: "Room expired" }, { status: 404 }); }
    if (this.ctx.getWebSockets().length >= MAX_ROOM_SOCKETS)
      return Response.json({ error: "Room has too many connection attempts" }, { status: 429, headers: { "Retry-After": "30" } });
    const pair = new WebSocketPair(); const client = pair[0]; const server = pair[1]; const now = Date.now();
    server.serializeAttachment({ playerId: null, roomId, connectedAt: now, rateWindowStartedAt: now, rateCount: 0 } satisfies SessionAttachment);
    this.ctx.acceptWebSocket(server);
    try { await this.scheduleExpiry(state); }
    catch { server.close(1013, "Room capacity unavailable"); return Response.json({ error: "Room capacity is temporarily unavailable" }, { status: 503 }); }
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attachment = webSocket.deserializeAttachment() as SessionAttachment | null;
    if (attachment === null) { webSocket.close(1011, "Session missing"); return; }
    const now = Date.now();
    if (now - this.roomRateWindowStartedAt >= RATE_WINDOW_MS) { this.roomRateWindowStartedAt = now; this.roomRateCount = 0; }
    this.roomRateCount += 1;
    if (this.roomRateCount > ROOM_RATE_LIMIT) { webSocket.send(errorMessage("rate_limited", "Room message budget exceeded.")); webSocket.close(1013, "Room busy"); return; }
    if (now - attachment.rateWindowStartedAt >= RATE_WINDOW_MS) { attachment.rateWindowStartedAt = now; attachment.rateCount = 0; }
    attachment.rateCount += 1; webSocket.serializeAttachment(attachment);
    if (attachment.rateCount > SOCKET_RATE_LIMIT) { webSocket.send(errorMessage("rate_limited", "Too many messages.")); webSocket.close(1008, "Rate limit exceeded"); return; }
    if (typeof message !== "string") {
      webSocket.send(errorMessage("invalid_message", "Binary messages are not supported."));
      webSocket.close(1003, "Binary messages are not supported"); return;
    }
    if (!isClientMessageWithinLimit(message)) { webSocket.close(1009, "Message exceeds the application limit"); return; }
    const parsed = parseClientMessage(message);
    if (parsed === undefined) { webSocket.send(errorMessage("invalid_message", "Message does not match protocol v1.")); return; }
    if (parsed.type === "client:ping") { webSocket.send(serializeServerMessage({ type: "server:pong", nonce: parsed.nonce })); return; }
    let state: RoomState | undefined;
    try { state = this.loadState(); } catch { webSocket.send(errorMessage("capacity_unavailable", "Room state is unavailable.")); webSocket.close(1013, "Try again later"); return; }
    if (state === undefined) { webSocket.send(errorMessage("internal_error", "Room state is unavailable.")); return; }
    if (attachment.playerId === null) {
      if (parsed.type !== "client:hello") { webSocket.send(errorMessage("not_admitted", "Send client:hello first.")); return; }
      const displayName = sanitizeDisplayName(parsed.displayName);
      if (displayName === undefined) { webSocket.send(errorMessage("invalid_message", "Display name is empty.")); return; }
      let token = parsed.reconnectToken;
      const admitted = token === undefined
        ? admitPlayer(state, { id: crypto.randomUUID(), displayName, tokenHash: await hashToken(token = newReconnectToken()), now })
        : reconnectPlayer(state, await hashToken(token), now);
      if (!admitted.ok) { webSocket.send(errorMessage(admitted.code, admitted.message)); webSocket.close(1008, admitted.message); return; }
      try { await this.persistAndSchedule(state); }
      catch { webSocket.send(errorMessage("capacity_unavailable", "Room capacity is temporarily unavailable.")); webSocket.close(1013, "Try again later"); return; }
      attachment.playerId = admitted.value.id; webSocket.serializeAttachment(attachment);
      for (const other of this.ctx.getWebSockets()) {
        if (other === webSocket) continue;
        const otherAttachment = other.deserializeAttachment() as SessionAttachment | null;
        if (otherAttachment?.playerId === admitted.value.id) { otherAttachment.replaced = true; other.serializeAttachment(otherAttachment); other.close(4001, "Replaced by reconnect"); }
      }
      webSocket.send(serializeServerMessage({ type: "server:hello", protocolVersion: PROTOCOL_VERSION,
        roomId: state.code, playerId: admitted.value.id, reconnectToken: token, reconnectGraceMs: RECONNECT_GRACE_MS }));
      this.broadcastState(state); return;
    }
    if (parsed.type === "client:hello") { webSocket.send(errorMessage("invalid_message", "Session is already admitted.")); return; }
    const result = applyRoomMessage(state, attachment.playerId, parsed, now);
    if (!result.ok) { webSocket.send(errorMessage(result.code, result.message)); return; }
    if (!result.changed) return;
    try { await this.persistAndSchedule(state); }
    catch { webSocket.send(errorMessage("capacity_unavailable", "Room capacity is temporarily unavailable.")); webSocket.close(1013, "Try again later"); return; }
    this.broadcastState(state);
    if (parsed.type === "room:leave") webSocket.close(1000, "Left room");
  }

  override async webSocketClose(webSocket: WebSocket, code: number): Promise<void> {
    const attachment = webSocket.deserializeAttachment() as SessionAttachment | null;
    if (attachment?.replaced || attachment?.playerId === null || attachment === null) return;
    const state = this.loadState(); if (state === undefined) return;
    const result = disconnectPlayer(state, attachment.playerId, Date.now());
    if (result.ok && result.changed) {
      try { await this.persistAndSchedule(state); this.broadcastState(state); } catch { /* output gate prevents a partial state broadcast */ }
    }
    const validCode = code === 1000 || (code >= 1001 && code <= 1014 && ![1004, 1005, 1006].includes(code)) || (code >= 3000 && code <= 4999);
    try { webSocket.close(validCode ? code : 1000, "Connection closed"); } catch { /* already closed */ }
  }
  override async webSocketError(webSocket: WebSocket): Promise<void> {
    await this.webSocketClose(webSocket, 1011);
  }
  override async alarm(): Promise<void> {
    let state: RoomState | undefined;
    try { state = this.loadState(); } catch { await this.expireRoom(); return; }
    if (state === undefined) return;
    const now = Date.now();
    if (isRoomExpired(state, now)) { await this.expireRoom(); return; }
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as SessionAttachment | null;
      if (attachment?.playerId === null && now - attachment.connectedAt >= PRE_ADMISSION_TIMEOUT_MS) {
        try { socket.close(1008, "Admission timed out"); } catch { /* stale socket */ }
      }
    }
    if (expireDisconnectedPlayers(state, now).length > 0) {
      try { await this.persistAndSchedule(state); this.broadcastState(state); } catch { await this.expireRoom(); }
    } else await this.scheduleExpiry(state);
  }
  private loadState(): RoomState | undefined {
    let row: { state_json: string } | undefined;
    try { row = this.ctx.storage.sql.exec<{ state_json: string }>("SELECT state_json FROM room_state WHERE singleton = 1").toArray()[0]; }
    catch (error) {
      if (error instanceof Error && error.message.includes("no such table")) return undefined;
      throw error;
    }
    if (row === undefined) return undefined;
    if (new TextEncoder().encode(row.state_json).byteLength > MAX_ROOM_SNAPSHOT_BYTES) throw new Error("Room snapshot exceeds limit");
    const parsed = JSON.parse(row.state_json) as unknown;
    if (!isRoomState(parsed)) throw new Error("Room snapshot is invalid");
    return parsed;
  }
  private saveState(state: RoomState): void {
    const encoded = JSON.stringify(state);
    if (new TextEncoder().encode(encoded).byteLength > MAX_ROOM_SNAPSHOT_BYTES) throw new Error("Room snapshot exceeds limit");
    this.ctx.storage.sql.exec("INSERT INTO room_state (singleton, state_json, updated_at) VALUES (1, ?, ?) ON CONFLICT(singleton) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at", encoded, state.updatedAt);
  }
  private broadcastState(state: RoomState): void {
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as SessionAttachment | null;
      if (attachment?.playerId !== null && attachment !== null && !attachment.replaced) {
        try { socket.send(serializeServerMessage({ type: "room:state", room: projectRoom(state, attachment.playerId, gameProjectionFor(state, attachment.playerId)) })); } catch { /* stale socket */ }
      }
    }
  }
  private async persistAndSchedule(state: RoomState): Promise<void> {
    this.saveState(state);
    try { await this.scheduleExpiry(state); }
    catch (error) { await this.expireRoom(); throw error; }
  }
  private async scheduleExpiry(state: RoomState): Promise<void> {
    const reconnectExpiry = state.players.filter((item) => !item.connected).map((item) => item.disconnectedAt)
      .filter((value): value is number => value !== null).map((value) => value + RECONNECT_GRACE_MS)
      .sort((a, b) => a - b)[0];
    const admissionExpiry = this.ctx.getWebSockets().map((socket) => socket.deserializeAttachment() as SessionAttachment | null)
      .filter((attachment) => attachment?.playerId === null).map((attachment) => attachment?.connectedAt ?? 0)
      .map((connectedAt) => connectedAt + PRE_ADMISSION_TIMEOUT_MS).sort((a, b) => a - b)[0];
    await this.ctx.storage.setAlarm(Math.min(reconnectExpiry ?? Number.POSITIVE_INFINITY,
      admissionExpiry ?? Number.POSITIVE_INFINITY, roomExpiresAt(state)));
  }
  private async expireRoom(): Promise<void> {
    for (const socket of this.ctx.getWebSockets()) {
      try { socket.close(4002, "Room expired"); } catch { /* stale socket */ }
    }
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }
}

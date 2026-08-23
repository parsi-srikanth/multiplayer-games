import { DurableObject } from "cloudflare:workers";
import { PROTOCOL_VERSION } from "../shared/game-contract";
import {
  isClientMessageWithinLimit,
  parseClientMessage,
  serializeServerMessage,
} from "../shared/protocol";
import type { ServerErrorMessage } from "../shared/protocol";
import { advanceStarting, admitPlayer, applyRoomMessage, createRoomState, disconnectPlayer,
  expireDisconnectedPlayers, isRoomExpired, projectRoom, reconnectPlayer, RECONNECT_GRACE_MS,
  roomExpiresAt, sanitizeDisplayName } from "./room-engine";
import type { RoomState } from "./room-engine";

const RATE_WINDOW_MS = 10_000;
const RATE_LIMIT = 30;
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

export class RoomDurableObject extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
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
      const code = request.headers.get("X-Room-ID");
      if (code === null) return Response.json({ error: "Room context missing" }, { status: 400 });
      const existing = this.loadState();
      if (existing !== undefined && !isRoomExpired(existing, Date.now())) return Response.json({ error: "Room already exists" }, { status: 409 });
      if (existing !== undefined) await this.expireRoom();
      const state = createRoomState(code, Date.now());
      this.saveState(state);
      await this.scheduleExpiry(state);
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
    const pair = new WebSocketPair(); const client = pair[0]; const server = pair[1]; const now = Date.now();
    server.serializeAttachment({ playerId: null, roomId, connectedAt: now, rateWindowStartedAt: now, rateCount: 0 } satisfies SessionAttachment);
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attachment = webSocket.deserializeAttachment() as SessionAttachment | null;
    if (attachment === null) { webSocket.close(1011, "Session missing"); return; }
    const now = Date.now();
    if (now - attachment.rateWindowStartedAt >= RATE_WINDOW_MS) { attachment.rateWindowStartedAt = now; attachment.rateCount = 0; }
    attachment.rateCount += 1; webSocket.serializeAttachment(attachment);
    if (attachment.rateCount > RATE_LIMIT) { webSocket.send(errorMessage("rate_limited", "Too many messages.")); webSocket.close(1008, "Rate limit exceeded"); return; }
    if (typeof message !== "string") {
      webSocket.send(errorMessage("invalid_message", "Binary messages are not supported."));
      webSocket.close(1003, "Binary messages are not supported");
      return;
    }
    if (!isClientMessageWithinLimit(message)) {
      webSocket.close(1009, "Message exceeds the application limit");
      return;
    }
    const parsed = parseClientMessage(message);
    if (parsed === undefined) { webSocket.send(errorMessage("invalid_message", "Message does not match protocol v1.")); return; }
    if (parsed.type === "client:ping") { webSocket.send(serializeServerMessage({ type: "server:pong", nonce: parsed.nonce })); return; }
    const state = this.loadState();
    if (state === undefined) { webSocket.send(errorMessage("internal_error", "Room state is unavailable.")); return; }
    if (attachment.playerId === null) {
      if (parsed.type !== "client:hello") { webSocket.send(errorMessage("not_admitted", "Send client:hello first.")); return; }
      const displayName = sanitizeDisplayName(parsed.displayName);
      if (displayName === undefined) { webSocket.send(errorMessage("invalid_message", "Display name is empty.")); return; }
      let token = parsed.reconnectToken;
      let admitted;
      if (token !== undefined) {
        admitted = reconnectPlayer(state, await hashToken(token), now);
      } else {
        token = newReconnectToken();
        admitted = admitPlayer(state, { id: crypto.randomUUID(), displayName, tokenHash: await hashToken(token), now });
      }
      if (!admitted.ok) { webSocket.send(errorMessage(admitted.code, admitted.message)); webSocket.close(1008, admitted.message); return; }
      attachment.playerId = admitted.value.id; webSocket.serializeAttachment(attachment);
      for (const other of this.ctx.getWebSockets()) {
        if (other === webSocket) continue;
        const otherAttachment = other.deserializeAttachment() as SessionAttachment | null;
        if (otherAttachment?.playerId === admitted.value.id) { otherAttachment.replaced = true; other.serializeAttachment(otherAttachment); other.close(4001, "Replaced by reconnect"); }
      }
      this.saveState(state);
      webSocket.send(serializeServerMessage({ type: "server:hello", protocolVersion: PROTOCOL_VERSION,
        roomId: state.code, playerId: admitted.value.id, reconnectToken: token, reconnectGraceMs: RECONNECT_GRACE_MS }));
      this.broadcastState(state); await this.scheduleExpiry(state); return;
    }
    if (parsed.type === "client:hello") { webSocket.send(errorMessage("invalid_message", "Session is already admitted.")); return; }
    const result = applyRoomMessage(state, attachment.playerId, parsed, now);
    if (!result.ok) { webSocket.send(errorMessage(result.code, result.message)); return; }
    if (!result.changed) return;
    this.saveState(state); this.broadcastState(state);
    if (state.phase === "starting") { advanceStarting(state, Date.now()); this.saveState(state); this.broadcastState(state); }
    await this.scheduleExpiry(state);
    if (parsed.type === "room:leave") webSocket.close(1000, "Left room");
  }

  override async webSocketClose(webSocket: WebSocket, code: number): Promise<void> {
    const attachment = webSocket.deserializeAttachment() as SessionAttachment | null;
    if (attachment?.replaced || attachment?.playerId === null || attachment === null) return;
    const state = this.loadState(); if (state === undefined) return;
    const result = disconnectPlayer(state, attachment.playerId, Date.now());
    if (result.ok && result.changed) { this.saveState(state); this.broadcastState(state); await this.scheduleExpiry(state); }
    const validCode = code === 1000 || (code >= 1001 && code <= 1014 && ![1004, 1005, 1006].includes(code)) || (code >= 3000 && code <= 4999);
    try { webSocket.close(validCode ? code : 1000, "Connection closed"); } catch { /* already closed */ }
  }
  override webSocketError(webSocket: WebSocket): void { webSocket.close(1011, "WebSocket error"); }
  override async alarm(): Promise<void> {
    const state = this.loadState(); if (state === undefined) return;
    if (isRoomExpired(state, Date.now())) { await this.expireRoom(); return; }
    if (expireDisconnectedPlayers(state, Date.now()).length > 0) { this.saveState(state); this.broadcastState(state); }
    await this.scheduleExpiry(state);
  }
  private loadState(): RoomState | undefined {
    const row = this.ctx.storage.sql.exec<{ state_json: string }>("SELECT state_json FROM room_state WHERE singleton = 1").toArray()[0];
    return row === undefined ? undefined : JSON.parse(row.state_json) as RoomState;
  }
  private saveState(state: RoomState): void {
    this.ctx.storage.sql.exec("INSERT INTO room_state (singleton, state_json, updated_at) VALUES (1, ?, ?) ON CONFLICT(singleton) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at", JSON.stringify(state), state.updatedAt);
  }
  private broadcastState(state: RoomState): void {
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as SessionAttachment | null;
      if (attachment?.playerId !== null && attachment !== null && !attachment.replaced) {
        try { socket.send(serializeServerMessage({ type: "room:state", room: projectRoom(state, attachment.playerId) })); } catch { /* stale socket */ }
      }
    }
  }
  private async scheduleExpiry(state: RoomState): Promise<void> {
    const reconnectExpiry = state.players.filter((item) => !item.connected).map((item) => item.disconnectedAt)
      .filter((value): value is number => value !== null)
      .map((value) => value + RECONNECT_GRACE_MS).sort((a, b) => a - b)[0];
    await this.ctx.storage.setAlarm(Math.min(reconnectExpiry ?? Number.POSITIVE_INFINITY, roomExpiresAt(state)));
  }
  private async expireRoom(): Promise<void> {
    for (const socket of this.ctx.getWebSockets()) {
      try { socket.close(4002, "Room expired"); } catch { /* stale socket */ }
    }
    await this.ctx.storage.deleteAll();
  }
}

import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { evictDurableObject, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import type { RoomProjection, ServerMessage } from "../shared/protocol";
import { ROOM_INACTIVE_TTL_MS } from "./room-engine";

const ORIGIN = "https://games.srikanthparsi.com";
class Inbox {
  private readonly messages: ServerMessage[] = [];
  private readonly listeners: (() => void)[] = [];
  constructor(readonly socket: WebSocket) {
    socket.accept();
    socket.addEventListener("message", (event) => {
      this.messages.push(JSON.parse(String(event.data)) as ServerMessage);
      for (const listener of this.listeners.splice(0)) listener();
    });
  }
  send(message: unknown): void { this.socket.send(JSON.stringify(message)); }
  async next(predicate: (message: ServerMessage) => boolean): Promise<ServerMessage> {
    const deadline = Date.now() + 3_000;
    while (Date.now() < deadline) {
      const index = this.messages.findIndex(predicate);
      if (index >= 0) {
        const message = this.messages.splice(index, 1)[0];
        if (message === undefined) throw new Error("Message queue changed unexpectedly");
        return message;
      }
      await new Promise<void>((resolve) => { this.listeners.push(resolve); setTimeout(resolve, 25); });
    }
    throw new Error("Timed out waiting for WebSocket message");
  }
  async state(predicate: (room: RoomProjection) => boolean): Promise<RoomProjection> {
    const message = await this.next((candidate) => candidate.type === "room:state" && predicate(candidate.room));
    if (message.type !== "room:state") throw new Error("Expected room state");
    return message.room;
  }
}
async function connect(code: string, name: string, reconnectToken?: string): Promise<{ inbox: Inbox; playerId: string; token: string }> {
  const response = await exports.default.fetch(`https://games.srikanthparsi.com/api/rooms/${code}/connect`, {
    headers: { Origin: ORIGIN, Upgrade: "websocket" },
  });
  expect(response.status).toBe(101);
  if (response.webSocket === null) throw new Error("Upgrade did not return a WebSocket");
  const inbox = new Inbox(response.webSocket);
  inbox.send({ type: "client:hello", protocolVersion: 1, displayName: name, ...(reconnectToken === undefined ? {} : { reconnectToken }) });
  const hello = await inbox.next((message) => message.type === "server:hello");
  if (hello.type !== "server:hello") throw new Error("Expected server hello");
  return { inbox, playerId: hello.playerId, token: hello.reconnectToken };
}

describe("RoomDurableObject integration", () => {
  it("rate limits room creation per client before allocating Durable Objects", async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await exports.default.fetch("https://games.srikanthparsi.com/api/rooms", {
        method: "POST", headers: { Origin: ORIGIN, "CF-Connecting-IP": "203.0.113.10" },
      });
      statuses.push(response.status);
    }
    expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
  });

  it("rate limits room access without creating SQLite storage for unknown codes", async () => {
    const headers = { "CF-Connecting-IP": "203.0.113.20" };
    const first = await exports.default.fetch("https://games.srikanthparsi.com/api/rooms/ZZZZZ", { headers });
    expect(first.status).toBe(404);
    const unknownStub = env.ROOMS.getByName("ZZZZZ");
    await runInDurableObject(unknownStub, (_instance, state) => {
      expect(state.storage.sql.exec<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'").toArray()).toEqual([]);
    });
    const statuses: number[] = [];
    for (let attempt = 1; attempt < 31; attempt += 1) {
      statuses.push((await exports.default.fetch("https://games.srikanthparsi.com/api/rooms/ZZZZZ", { headers })).status);
    }
    expect(statuses.slice(0, 29).every((status) => status === 404)).toBe(true);
    expect(statuses[29]).toBe(429);
  });

  it("persists through hibernation, reconnects, derives scores, and deletes expired SQLite state", async () => {
    const created = await exports.default.fetch("https://games.srikanthparsi.com/api/rooms", { method: "POST", headers: { Origin: ORIGIN } });
    expect(created.status).toBe(201);
    const { code } = await created.json<{ code: string }>();
    const a = await connect(code, "Ada");
    const b = await connect(code, "Ben");
    expect((await a.inbox.state((room) => room.players.length === 2)).players).toHaveLength(2);

    a.inbox.send({ type: "room:select_game", gameId: "cows-bulls-challenge" });
    await a.inbox.state((room) => room.selectedGameId === "cows-bulls-challenge");
    a.inbox.send({ type: "room:start" });
    await a.inbox.state((room) => room.phase === "playing");
    a.inbox.send({ type: "game:command", command: { type: "set-secret", word: "APPLE" } });
    await a.inbox.state((room) => room.game !== null && JSON.stringify(room.game).includes(a.playerId));
    expect(JSON.stringify(await b.inbox.state((room) => room.game !== null))).not.toContain("APPLE");
    b.inbox.send({ type: "game:command", command: { type: "set-secret", word: "GRAPE" } });
    await b.inbox.state((room) => JSON.stringify(room.game).includes(b.playerId));
    a.inbox.send({ type: "game:command", command: { type: "guess", targetPlayerId: b.playerId, word: "GRAPE" } });
    await a.inbox.state((room) => room.phase === "playing");
    b.inbox.send({ type: "game:command", command: { type: "guess", targetPlayerId: a.playerId, word: "APPLE" } });
    const results = await a.inbox.state((room) => room.phase === "results");
    expect(results.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ playerId: a.playerId, score: 160, rank: 1 }),
      expect.objectContaining({ playerId: b.playerId, score: 160, rank: 1 }),
    ]));

    const stub = env.ROOMS.getByName(code);
    await evictDurableObject(stub);
    a.inbox.send({ type: "room:return_lobby" });
    expect((await a.inbox.state((room) => room.phase === "lobby" && room.players.length === 2 &&
      room.players.every((player) => player.sessionScore === 160))).players.map((player) => player.sessionScore))
      .toEqual([160, 160]);

    b.inbox.socket.close(1000, "refresh");
    await a.inbox.state((room) => room.players.some((player) => player.id === b.playerId && player.presence === "reconnecting"));
    const reconnected = await connect(code, "Ben", b.token);
    expect(reconnected.playerId).toBe(b.playerId);

    const scheduledAlarm = await runInDurableObject(stub, async (_instance, state) => {
      const row = state.storage.sql.exec<{ state_json: string }>("SELECT state_json FROM room_state WHERE singleton = 1").toArray()[0];
      if (row === undefined) throw new Error("Expected room state");
      const snapshot = JSON.parse(row.state_json) as Record<string, unknown>;
      snapshot.updatedAt = Date.now() - ROOM_INACTIVE_TTL_MS - 1;
      state.storage.sql.exec("UPDATE room_state SET state_json = ?, updated_at = ? WHERE singleton = 1", JSON.stringify(snapshot), snapshot.updatedAt);
      await state.storage.setAlarm(Date.now() + 60_000);
      return state.storage.getAlarm();
    });
    expect(scheduledAlarm).not.toBeNull();
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    const info = await exports.default.fetch(`https://games.srikanthparsi.com/api/rooms/${code}`);
    expect(info.status).toBe(404);
    await runInDurableObject(stub, async (_instance, state) => { expect(await state.storage.getAlarm()).toBeNull(); });
  });
});

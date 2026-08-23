import { describe, expect, it } from "vitest";
import { admitPlayer, applyRoomMessage, createRoomState, disconnectPlayer, expireDisconnectedPlayers,
  gameProjectionFor, isRoomExpired, projectRoom, reconnectPlayer, RECONNECT_GRACE_MS,
  ROOM_INACTIVE_TTL_MS, roomExpiresAt, sanitizeDisplayName } from "./room-engine";
import type { RoomState } from "./room-engine";

function roomWithPlayers(count = 2): RoomState {
  const state = createRoomState("ABCDE", 1);
  for (let index = 1; index <= count; index += 1) {
    const suffix = String(index);
    const result = admitPlayer(state, { id: `p${suffix}`, displayName: `Player ${suffix}`, tokenHash: `token-${suffix}`, now: index + 1 });
    expect(result.ok).toBe(true);
  }
  return state;
}
function command(state: RoomState, actor: string, value: unknown, now: number): void {
  const result = applyRoomMessage(state, actor, { type: "game:command", command: value }, now);
  expect(result).toMatchObject({ ok: true, changed: true });
}
function startChallenge(state: RoomState, now = 10): void {
  expect(applyRoomMessage(state, "p1", { type: "room:select_game", gameId: "cows-bulls-challenge" }, now).ok).toBe(true);
  expect(applyRoomMessage(state, "p1", { type: "room:start" }, now + 1).ok).toBe(true);
  expect(state.phase).toBe("playing");
}

describe("authoritative room engine", () => {
  it("uses a 30-minute reconnect grace and a sliding 24-hour inactivity expiry", () => {
    const state = createRoomState("ABCDE", 100);
    expect(RECONNECT_GRACE_MS).toBe(30 * 60 * 1000);
    expect(roomExpiresAt(state)).toBe(100 + ROOM_INACTIVE_TTL_MS);
    expect(isRoomExpired(state, roomExpiresAt(state) - 1)).toBe(false);
    expect(isRoomExpired(state, roomExpiresAt(state))).toBe(true);
    admitPlayer(state, { id: "p1", displayName: "Player", tokenHash: "token", now: 500 });
    expect(roomExpiresAt(state)).toBe(500 + ROOM_INACTIVE_TTL_MS);
  });
  it("sanitizes temporary nicknames", () => {
    expect(sanitizeDisplayName("  Ada\u0000   Lovelace  ")).toBe("Ada Lovelace");
    expect(sanitizeDisplayName("Ａｄａ")).toBe("Ada");
    expect(sanitizeDisplayName("\u0000 \n")).toBeUndefined();
    expect(sanitizeDisplayName("x".repeat(40))).toHaveLength(24);
  });
  it("assigns the first player as host and enforces four-player capacity", () => {
    const state = roomWithPlayers(4);
    expect(state.hostId).toBe("p1");
    expect(admitPlayer(state, { id: "p5", displayName: "Five", tokenHash: "t5", now: 8 }))
      .toMatchObject({ ok: false, code: "room_full" });
  });
  it("reconnects during grace and elects only connected hosts", () => {
    const state = roomWithPlayers(3);
    expect(disconnectPlayer(state, "p2", 100).ok).toBe(true);
    expect(disconnectPlayer(state, "p1", 101).ok).toBe(true);
    expect(state.hostId).toBe("p3");
    expect(reconnectPlayer(state, "token-2", 200)).toMatchObject({ ok: true, value: { id: "p2", connected: true } });
    expect(state.hostId).toBe("p3");
    expect(expireDisconnectedPlayers(state, 101 + RECONNECT_GRACE_MS - 1)).toEqual([]);
    expect(expireDisconnectedPlayers(state, 101 + RECONNECT_GRACE_MS)).toEqual(["p1"]);
  });
  it("enforces reconnect expiry synchronously even when an alarm is delayed", () => {
    const beforeDeadline = roomWithPlayers(1);
    disconnectPlayer(beforeDeadline, "p1", 100);
    expect(reconnectPlayer(beforeDeadline, "token-1", 100 + RECONNECT_GRACE_MS - 1)).toMatchObject({ ok: true });

    const atDeadline = roomWithPlayers(1);
    disconnectPlayer(atDeadline, "p1", 100);
    expect(reconnectPlayer(atDeadline, "token-1", 100 + RECONNECT_GRACE_MS)).toMatchObject({ ok: false, code: "not_admitted" });

    const afterDelayedAlarm = roomWithPlayers(1);
    disconnectPlayer(afterDelayedAlarm, "p1", 100);
    expect(reconnectPlayer(afterDelayedAlarm, "token-1", 100 + RECONNECT_GRACE_MS + 60_000))
      .toMatchObject({ ok: false, code: "not_admitted" });
  });
  it("rejects unknown games and derives results only from validated game commands", () => {
    const state = roomWithPlayers();
    expect(applyRoomMessage(state, "p2", { type: "room:select_game", gameId: "cows-bulls-challenge" }, 10))
      .toMatchObject({ ok: false, code: "forbidden" });
    expect(applyRoomMessage(state, "p1", { type: "room:select_game", gameId: "not-real" }, 11))
      .toMatchObject({ ok: false, code: "game_not_configured" });
    startChallenge(state, 12);
    command(state, "p1", { type: "set-secret", word: "APPLE" }, 14);
    expect(JSON.stringify(gameProjectionFor(state, "p2"))).not.toContain("APPLE");
    command(state, "p2", { type: "set-secret", word: "GRAPE" }, 15);
    command(state, "p1", { type: "guess", targetPlayerId: "p2", word: "GRAPE" }, 16);
    command(state, "p2", { type: "guess", targetPlayerId: "p1", word: "APPLE" }, 17);
    expect(state.phase).toBe("results");
    expect(state.results).toEqual([
      { playerId: "p1", score: 160, rank: 1 },
      { playerId: "p2", score: 160, rank: 1 },
    ]);
    expect(state.players.map((item) => item.sessionScore)).toEqual([160, 160]);
    expect(JSON.stringify(gameProjectionFor(state, "p2"))).toContain("APPLE");
    expect(applyRoomMessage(state, "p1", { type: "room:return_lobby" }, 18).ok).toBe(true);
    expect(state.privateGameState).toBeNull();
    expect(state.players.map((item) => item.sessionScore)).toEqual([160, 160]);
  });
  it("supports an authoritative rematch while retaining session scores", () => {
    const state = roomWithPlayers();
    startChallenge(state);
    command(state, "p1", { type: "set-secret", word: "APPLE" }, 12);
    command(state, "p2", { type: "set-secret", word: "GRAPE" }, 13);
    command(state, "p1", { type: "guess", targetPlayerId: "p2", word: "GRAPE" }, 14);
    command(state, "p2", { type: "guess", targetPlayerId: "p1", word: "APPLE" }, 15);
    expect(applyRoomMessage(state, "p1", { type: "room:rematch" }, 16).ok).toBe(true);
    expect(state.phase).toBe("playing");
    expect(state.players.map((item) => item.sessionScore)).toEqual([160, 160]);
    expect(gameProjectionFor(state, "p1")).toMatchObject({ phase: "secrets" });
  });
  it("never exposes reconnect credentials or unprojected private game state", () => {
    const state = roomWithPlayers();
    state.privateGameState = { hands: { p1: ["secret"] } };
    const projected = projectRoom(state, "p1", { hand: ["viewer-card"] });
    expect(projected.game).toEqual({ hand: ["viewer-card"] });
    expect(JSON.stringify(projected)).not.toContain("token-1");
    expect(JSON.stringify(projected)).not.toContain("secret");
    expect(projected.viewer).toEqual({ playerId: "p1", isHost: true });
  });
});

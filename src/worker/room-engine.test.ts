import { describe, expect, it } from "vitest";
import { admitPlayer, advanceStarting, applyRoomMessage, createRoomState, disconnectPlayer,
  expireDisconnectedPlayers, isRoomExpired, projectRoom, reconnectPlayer, RECONNECT_GRACE_MS,
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
    expect(admitPlayer(state, { id: "p5", displayName: "Five", tokenHash: "t5", now: 8 })).toMatchObject({ ok: false, code: "room_full" });
  });
  it("reconnects during grace and expires/host-transfers after grace", () => {
    const state = roomWithPlayers();
    expect(disconnectPlayer(state, "p1", 100).ok).toBe(true);
    expect(projectRoom(state, "p2").players[0]?.presence).toBe("reconnecting");
    expect(reconnectPlayer(state, "token-1", 200)).toMatchObject({ ok: true, value: { id: "p1", connected: true } });
    disconnectPlayer(state, "p1", 300);
    expect(expireDisconnectedPlayers(state, 300 + RECONNECT_GRACE_MS - 1)).toEqual([]);
    expect(expireDisconnectedPlayers(state, 300 + RECONNECT_GRACE_MS)).toEqual(["p1"]);
    expect(state.hostId).toBe("p2");
  });
  it("enforces host controls and Lobby -> Starting -> Playing -> Results -> Lobby", () => {
    const state = roomWithPlayers();
    expect(applyRoomMessage(state, "p2", { type: "room:select_game", gameId: "quiz" }, 10)).toMatchObject({ ok: false, code: "forbidden" });
    expect(applyRoomMessage(state, "p1", { type: "room:start" }, 11)).toMatchObject({ ok: false, code: "invalid_transition" });
    expect(applyRoomMessage(state, "p1", { type: "room:select_game", gameId: "quiz" }, 12).ok).toBe(true);
    expect(applyRoomMessage(state, "p1", { type: "room:start" }, 13).ok).toBe(true);
    expect(state.phase).toBe("starting"); expect(advanceStarting(state, 14)).toBe(true); expect(state.phase).toBe("playing");
    expect(applyRoomMessage(state, "p2", { type: "game:score", playerId: "p2", delta: 5 }, 15)).toMatchObject({ ok: false, code: "forbidden" });
    expect(applyRoomMessage(state, "p1", { type: "game:score", playerId: "p2", delta: 5 }, 16).ok).toBe(true);
    expect(applyRoomMessage(state, "p1", { type: "game:score", playerId: "p1", delta: 2 }, 17).ok).toBe(true);
    expect(applyRoomMessage(state, "p1", { type: "game:finish" }, 18).ok).toBe(true);
    expect(state.phase).toBe("results"); expect(state.results).toEqual([{ playerId: "p2", score: 5, rank: 1 }, { playerId: "p1", score: 2, rank: 2 }]);
    expect(state.players.map((item) => item.sessionScore)).toEqual([2, 5]);
    expect(applyRoomMessage(state, "p1", { type: "room:return_lobby" }, 19).ok).toBe(true);
    expect(state.phase).toBe("lobby"); expect(state.players.map((item) => item.gameScore)).toEqual([0, 0]);
    expect(state.players.map((item) => item.sessionScore)).toEqual([2, 5]);
  });
  it("supports rematch while retaining cumulative session scores", () => {
    const state = roomWithPlayers(1);
    applyRoomMessage(state, "p1", { type: "room:select_game", gameId: "quiz" }, 10);
    applyRoomMessage(state, "p1", { type: "room:start" }, 11); advanceStarting(state, 12);
    applyRoomMessage(state, "p1", { type: "game:score", playerId: "p1", delta: 9 }, 13);
    applyRoomMessage(state, "p1", { type: "game:finish" }, 14);
    expect(applyRoomMessage(state, "p1", { type: "room:rematch" }, 15).ok).toBe(true);
    expect(state.phase).toBe("starting"); expect(state.players[0]?.sessionScore).toBe(9); expect(state.players[0]?.gameScore).toBe(0);
  });
  it("never exposes reconnect credentials or server-private game state", () => {
    const state = roomWithPlayers(); state.privateGameState = { hands: { p1: ["secret"] } };
    const projected = projectRoom(state, "p1", { hand: ["viewer-card"] });
    expect(projected.game).toEqual({ hand: ["viewer-card"] });
    expect(JSON.stringify(projected)).not.toContain("token-1"); expect(JSON.stringify(projected)).not.toContain("secret");
    expect(projected.viewer).toEqual({ playerId: "p1", isHost: true });
  });
});

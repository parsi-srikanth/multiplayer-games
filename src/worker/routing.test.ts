import { describe, expect, it } from "vitest";
import { generateRoomCode, isAllowedOrigin, isWebSocketUpgrade, roomIdFromPath, roomInfoIdFromPath, ROOM_CODE_ALPHABET } from "./routing";

describe("room routing and edge policy", () => {
  it("accepts only canonical five-character room codes", () => {
    expect(roomIdFromPath("/api/rooms/23456/connect")).toBe("23456");
    expect(roomInfoIdFromPath("/api/rooms/ABCDE")).toBe("ABCDE");
    for (const code of ["ABCD", "ABCDEF", "abcde", "A0CDE", "AICDE", "AOCDE", "ALCDE", "AB_CD"])
      expect(roomIdFromPath(`/api/rooms/${code}/connect`)).toBeUndefined();
  });
  it("generates a secure-alphabet five-character code", () => {
    const code = generateRoomCode(() => new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]));
    expect(code).toBe(ROOM_CODE_ALPHABET.slice(0, 5)); expect(code).toHaveLength(5);
    expect(code).not.toMatch(/[01ILO]/);
  });
  it("recognizes only GET WebSocket upgrades", () => {
    expect(isWebSocketUpgrade(new Request("https://example.test", { headers: { Upgrade: "websocket" } }))).toBe(true);
    expect(isWebSocketUpgrade(new Request("https://example.test", { method: "POST", headers: { Upgrade: "websocket" } }))).toBe(false);
  });
  it("allows the canonical production origin", () => { expect(isAllowedOrigin("https://games.srikanthparsi.com")).toBe(true); });
  it.each([["http://localhost:5173", "localhost"], ["https://127.0.0.1:8787", "127.0.0.1"]])(
    "allows local origin %s only for local request host %s", (origin, host) => {
      expect(isAllowedOrigin(origin, host)).toBe(true);
      expect(isAllowedOrigin(origin, "games.srikanthparsi.com")).toBe(false);
    });
  it.each(["https://evil.example", "https://games.srikanthparsi.com.evil.example", "null", "not a url"])("rejects origin %s", (origin) => {
    expect(isAllowedOrigin(origin)).toBe(false);
  });
});

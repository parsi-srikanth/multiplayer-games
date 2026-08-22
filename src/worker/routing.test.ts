import { describe, expect, it } from "vitest";
import { isWebSocketUpgrade, roomIdFromPath } from "./routing";

describe("room routing", () => {
  it.each(["abc", "room-42", "a-very-long-room-name"])("accepts room id %s", (roomId) => {
    expect(roomIdFromPath(`/api/rooms/${roomId}/connect`)).toBe(roomId);
  });

  it.each(["ABCD", "ab", "-room", "room_name", "room/extra"])("rejects room id %s", (roomId) => {
    expect(roomIdFromPath(`/api/rooms/${roomId}/connect`)).toBeUndefined();
  });

  it("recognizes only GET WebSocket upgrades", () => {
    expect(isWebSocketUpgrade(new Request("https://example.test", { headers: { Upgrade: "websocket" } }))).toBe(true);
    expect(isWebSocketUpgrade(new Request("https://example.test", { method: "POST", headers: { Upgrade: "websocket" } }))).toBe(false);
  });
});

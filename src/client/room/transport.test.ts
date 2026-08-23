import { describe, expect, it, vi } from "vitest";
import { MockRoomTransport } from "./transport";

describe("MockRoomTransport", () => {
  it("creates a hosted room and notifies subscribers of settings", async () => {
    const transport = new MockRoomTransport();
    const room = await transport.createRoom({ displayName: "Ari", gameId: "chess" });
    const listener = vi.fn();
    const unsubscribe = transport.subscribe(room.id, listener);

    await transport.updateSettings(room.id, "trivia", 5);

    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ gameId: "trivia", rounds: 5 }));
    unsubscribe();
  });

  it("rejects malformed short room codes", async () => {
    const transport = new MockRoomTransport();
    await expect(transport.joinRoom({ displayName: "Ari", roomId: "x" })).rejects.toThrow(/at least 4/i);
  });
});

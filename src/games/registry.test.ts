import { describe, expect, it } from "vitest";
import { GameRegistry } from "./registry";

const stubGame = {
  id: "stub",
  name: "Stub",
  description: "Test game",
  minimumPlayers: 2,
  maximumPlayers: 4,
};

describe("GameRegistry", () => {
  it("registers and lists independent game modules", () => {
    const registry = new GameRegistry();
    registry.register(stubGame);
    expect(registry.get("stub")).toBe(stubGame);
    expect(registry.list()).toEqual([stubGame]);
  });

  it("rejects duplicate game identifiers", () => {
    const registry = new GameRegistry();
    registry.register(stubGame);
    expect(() => {
      registry.register(stubGame);
    }).toThrow("already registered");
  });
});

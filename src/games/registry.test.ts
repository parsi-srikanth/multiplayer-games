import { describe, expect, it } from "vitest";
import type { GameDefinition } from "../shared/game-contract";
import { GameRegistry, gameRegistry } from "./registry";

interface StubState { readonly done: boolean }
const stubGame: GameDefinition<StubState, { readonly type: "finish" }, StubState> = {
  metadata: { id: "stub", name: "Stub", description: "Test game", minimumPlayers: 2, maximumPlayers: 4 },
  createInitialState: () => ({ done: false }),
  validateCommand: (value): value is { readonly type: "finish" } =>
    typeof value === "object" && value !== null && "type" in value && value.type === "finish",
  applyCommand: () => ({ accepted: true, state: { done: true } }),
  projectState: (state) => state,
  isComplete: (state) => state.done,
  getScores: () => ({}),
};

describe("GameRegistry", () => {
  it("registers every implemented authoritative V1 game", () => {
    expect(gameRegistry.list().map((game) => game.id)).toEqual([
      "cows-bulls-challenge",
      "cows-bulls-classic",
      "word-race",
      "tic-tac-toe-plus",
      "dots-boxes",
      "connect-four",
    ]);
  });

  it("registers and adapts independent game modules", () => {
    const registry = new GameRegistry();
    registry.register(stubGame);
    expect(registry.get("stub")?.metadata).toBe(stubGame.metadata);
    expect(registry.list()).toEqual([stubGame.metadata]);
    expect(registry.get("stub")?.applyCommand({ done: false }, { type: "finish" }, "p1", "ABCDE", 1))
      .toMatchObject({ accepted: true, state: { done: true } });
  });

  it("rejects duplicate game identifiers", () => {
    const registry = new GameRegistry();
    registry.register(stubGame);
    expect(() => { registry.register(stubGame); }).toThrow("already registered");
  });
});

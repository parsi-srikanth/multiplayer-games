import { describe, expect, it } from "vitest";
import { clientGames, getClientGame } from "./catalog";

describe("client game discovery", () => {
  it("discovers ten unique game directories without a central route table", () => {
    expect(clientGames).toHaveLength(10);
    expect(new Set(clientGames.map((game) => game.metadata.id)).size).toBe(10);
    expect(clientGames.every((game) => typeof game.View === "function")).toBe(true);
  });

  it("finds a discovered view by game id", () => {
    expect(getClientGame("connect-four")?.metadata.name).toBe("Connect Four");
    expect(getClientGame("not-a-game")).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { clientGames, getClientGame } from "./catalog";

describe("client game discovery", () => {
  it("discovers the ten V1 games without a central route table", () => {
    const expectedIds = [
      "category-blitz",
      "connect-four",
      "cows-bulls-classic",
      "cows-bulls-challenge",
      "dots-boxes",
      "memory-match",
      "sudoku-sprint",
      "tic-tac-toe",
      "trivia-blitz",
      "word-race",
    ];

    expect(clientGames.map((game) => game.metadata.id)).toEqual(expectedIds);
    expect(new Set(clientGames.map((game) => game.metadata.id)).size).toBe(10);
    expect(clientGames.every((game) => typeof game.View === "function")).toBe(true);
  });

  it("finds a discovered view by game id", () => {
    expect(getClientGame("connect-four")?.metadata.name).toBe("Connect Four");
    expect(getClientGame("not-a-game")).toBeUndefined();
  });
});

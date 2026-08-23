import { describe, expect, it } from "vitest";
import { ticTacToePlus } from "./game";

const players = [{ id: "a", displayName: "Ada" }, { id: "b", displayName: "Ben" }] as const;
const context = { roomId: "ABCDE", now: 1 };

function move(state: ReturnType<typeof ticTacToePlus.createInitialState>, actor: string, index: number) {
  const result = ticTacToePlus.applyCommand(state, { type: "place", index }, actor, context);
  if (!result.accepted) throw new Error(result.reason);
  return result.state;
}

describe("Tic-Tac-Toe+", () => {
  it("enforces two players, turns, bounds, and occupied squares", () => {
    expect(() => ticTacToePlus.createInitialState(players.slice(0, 1), context)).toThrow();
    const initial = ticTacToePlus.createInitialState(players, context);
    expect(ticTacToePlus.applyCommand(initial, { type: "place", index: 0 }, "b", context)).toEqual({ accepted: false, reason: "Wait for your turn." });
    const next = move(initial, "a", 0);
    expect(ticTacToePlus.applyCommand(next, { type: "place", index: 0 }, "b", context)).toEqual({ accepted: false, reason: "That square is occupied." });
    expect(ticTacToePlus.validateCommand({ type: "place", index: 16 })).toBe(false);
  });

  it("finds horizontal, vertical, and diagonal three-in-a-row wins", () => {
    for (const sequence of [[0, 4, 1, 5, 2], [0, 1, 4, 2, 8], [0, 1, 5, 2, 10]]) {
      let state = ticTacToePlus.createInitialState(players, context);
      sequence.forEach((index, turn) => { state = move(state, turn % 2 === 0 ? "a" : "b", index); });
      expect(state.winnerId).toBe("a");
      expect(ticTacToePlus.isComplete?.(state)).toBe(true);
      expect(ticTacToePlus.getScores?.(state)).toEqual({ a: 3, b: 0 });
    }
  });

  it("projects no hidden state and does not mutate prior boards", () => {
    const initial = ticTacToePlus.createInitialState(players, context);
    const next = move(initial, "a", 0);
    expect(initial.board[0]).toBeNull();
    expect(ticTacToePlus.projectState(next, "b")).toEqual(expect.objectContaining({ board: next.board, currentPlayerId: "b" }));
  });
});

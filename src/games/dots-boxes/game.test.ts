import { describe, expect, it } from "vitest";
import { dotsBoxes } from "./game";
import type { DotsBoxesCommand, DotsBoxesState } from "./game";

const players = [{ id: "a", displayName: "Ada" }, { id: "b", displayName: "Ben" }] as const;
const context = { roomId: "ABCDE", now: 1 };
function claim(state: DotsBoxesState, actor: string, command: Omit<DotsBoxesCommand, "type">): DotsBoxesState {
  const result = dotsBoxes.applyCommand(state, { type: "claim-edge", ...command }, actor, context);
  if (!result.accepted) throw new Error(result.reason);
  return result.state;
}

describe("Dots & Boxes", () => {
  it("bounds commands, enforces turns, and rejects duplicate edges", () => {
    const initial = dotsBoxes.createInitialState(players, context);
    expect(dotsBoxes.validateCommand({ type: "claim-edge", orientation: "h", row: 4, column: 3 })).toBe(false);
    expect(dotsBoxes.applyCommand(initial, { type: "claim-edge", orientation: "h", row: 0, column: 0 }, "b", context)).toMatchObject({ accepted: false });
    const next = claim(initial, "a", { orientation: "h", row: 0, column: 0 });
    expect(dotsBoxes.applyCommand(next, { type: "claim-edge", orientation: "h", row: 0, column: 0 }, "b", context)).toEqual({ accepted: false, reason: "That edge is already claimed." });
  });

  it("awards a completed box and preserves the scorer's turn", () => {
    let state = dotsBoxes.createInitialState(players, context);
    state = claim(state, "a", { orientation: "h", row: 0, column: 0 });
    state = claim(state, "b", { orientation: "v", row: 0, column: 0 });
    state = claim(state, "a", { orientation: "h", row: 1, column: 0 });
    state = claim(state, "b", { orientation: "v", row: 0, column: 1 });
    expect(state.boxes["0-0"]).toBe("b");
    expect(state.currentPlayerId).toBe("b");
    expect(dotsBoxes.getScores?.(state)).toEqual({ a: 0, b: 1 });
  });

  it("awards both adjacent boxes and preserves the scorer's turn", () => {
    let state = dotsBoxes.createInitialState(players, context);
    const commands: readonly DotsBoxesCommand[] = [
      { type: "claim-edge", orientation: "h", row: 0, column: 0 },
      { type: "claim-edge", orientation: "h", row: 1, column: 0 },
      { type: "claim-edge", orientation: "v", row: 0, column: 0 },
      { type: "claim-edge", orientation: "h", row: 0, column: 1 },
      { type: "claim-edge", orientation: "h", row: 1, column: 1 },
      { type: "claim-edge", orientation: "v", row: 0, column: 2 },
      { type: "claim-edge", orientation: "v", row: 0, column: 1 },
    ];
    for (const command of commands) state = claim(state, state.currentPlayerId, command);
    expect(state.boxes).toEqual({ "0-0": "a", "0-1": "a" });
    expect(state.currentPlayerId).toBe("a");
    expect(dotsBoxes.getScores?.(state)).toEqual({ a: 2, b: 0 });
  });

  it("finishes after all 24 unique edges and exposes only public board state", () => {
    let state = dotsBoxes.createInitialState(players, context);
    const commands: DotsBoxesCommand[] = [];
    for (let row = 0; row <= 3; row += 1) for (let column = 0; column < 3; column += 1) commands.push({ type: "claim-edge", orientation: "h", row, column });
    for (let row = 0; row < 3; row += 1) for (let column = 0; column <= 3; column += 1) commands.push({ type: "claim-edge", orientation: "v", row, column });
    for (const command of commands) state = claim(state, state.currentPlayerId, command);
    expect(Object.keys(state.edges)).toHaveLength(24);
    expect(dotsBoxes.isComplete?.(state)).toBe(true);
    expect(Object.values(dotsBoxes.getScores?.(state) ?? {}).reduce((sum, value) => sum + value, 0)).toBe(9);
    expect(dotsBoxes.projectState(state, "a")).toEqual(expect.objectContaining({ edges: state.edges, boxes: state.boxes }));
  });
});

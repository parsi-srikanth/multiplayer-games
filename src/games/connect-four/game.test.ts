import { describe, expect, it } from "vitest";
import { connectFour } from "./game";
const players = [{ id: "a", displayName: "Ada" }, { id: "b", displayName: "Ben" }] as const;
const ctx = { roomId: "ROOM1", now: 1 };
function drop(state: ReturnType<typeof connectFour.createInitialState>, column: number) { const result = connectFour.applyCommand(state, { type: "drop", column }, state.currentPlayerId, ctx); if (!result.accepted) throw new Error(result.reason); return result.state; }
describe("Connect Four", () => {
  it("enforces gravity, turns and immutable boards", () => { const initial = connectFour.createInitialState(players, ctx); const next = drop(initial, 2); expect(initial.board.every((v) => v === null)).toBe(true); expect(next.board[5 * 7 + 2]).toBe("a"); expect(next.currentPlayerId).toBe("b"); expect(connectFour.applyCommand(next, { type: "drop", column: 1 }, "a", ctx)).toMatchObject({ accepted: false }); });
  it("detects a horizontal connect four and derives score", () => { let state = connectFour.createInitialState(players, ctx); for (const column of [0, 0, 1, 1, 2, 2, 3]) state = drop(state, column); expect(state).toMatchObject({ complete: true, winnerId: "a" }); expect(connectFour.getScores?.(state)).toEqual({ a: 1, b: 0 }); });
  it("rejects full columns and malformed commands", () => { let state = connectFour.createInitialState(players, ctx); for (let i = 0; i < 6; i += 1) state = drop(state, 0); expect(connectFour.applyCommand(state, { type: "drop", column: 0 }, state.currentPlayerId, ctx)).toMatchObject({ accepted: false }); expect(connectFour.validateCommand({ type: "drop", column: 7 })).toBe(false); });
});

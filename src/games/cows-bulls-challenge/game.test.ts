import { describe, expect, it } from "vitest";
import type { GameContext, PlayerView } from "../../shared/game-contract";
import { cowsBullsChallenge, MAX_GUESSES_PER_TARGET } from "./game";
import { scoreCowsAndBulls } from "./scoring";

const players: readonly PlayerView[] = [
  { id: "a", displayName: "Ada" },
  { id: "b", displayName: "Ben" },
];
const context: GameContext = { roomId: "ABCDE", now: 1 };

function accepted(state: ReturnType<typeof cowsBullsChallenge.createInitialState>, command: Parameters<typeof cowsBullsChallenge.applyCommand>[1], actor: string) {
  const result = cowsBullsChallenge.applyCommand(state, command, actor, context);
  if (!result.accepted) throw new Error(result.reason);
  return result.state;
}

describe("Cows & Bulls Player Challenge", () => {
  it("handles duplicate letters without double counting", () => {
    expect(scoreCowsAndBulls("APPLE", "ALLEY")).toEqual({ bulls: 1, cows: 2 });
    expect(scoreCowsAndBulls("SHEEP", "PEEPS")).toEqual({ bulls: 1, cows: 3 });
  });

  it("rejects garbage and locks each secret once", () => {
    const initial = cowsBullsChallenge.createInitialState(players, context);
    expect(cowsBullsChallenge.applyCommand(initial, { type: "set-secret", word: "XXXXX" }, "a", context)).toEqual({
      accepted: false,
      reason: "Choose a valid common five-letter word.",
    });
    const locked = accepted(initial, { type: "set-secret", word: "apple" }, "a");
    expect(cowsBullsChallenge.applyCommand(locked, { type: "set-secret", word: "GRAPE" }, "a", context)).toEqual({
      accepted: false,
      reason: "Your secret is already locked.",
    });
  });

  it("keeps opponents' secrets hidden until results", () => {
    let state = cowsBullsChallenge.createInitialState(players, context);
    state = accepted(state, { type: "set-secret", word: "APPLE" }, "a");
    state = accepted(state, { type: "set-secret", word: "GRAPE" }, "b");
    const aView = cowsBullsChallenge.projectState(state, "a");
    expect(aView.ownSecret).toBe("APPLE");
    expect(aView.targets[0]?.secret).toBeUndefined();
    expect(JSON.stringify(aView)).not.toContain("GRAPE");
  });

  it("supports concurrent attacks, completes, and awards understandable points", () => {
    let state = cowsBullsChallenge.createInitialState(players, context);
    state = accepted(state, { type: "set-secret", word: "APPLE" }, "a");
    state = accepted(state, { type: "set-secret", word: "GRAPE" }, "b");
    state = accepted(state, { type: "guess", targetPlayerId: "b", word: "GRAPE" }, "a");
    state = accepted(state, { type: "guess", targetPlayerId: "a", word: "APPLE" }, "b");
    expect(state.phase).toBe("results");
    expect(state.scores.a).toBe(160);
    expect(state.scores.b).toBe(160);
    expect(cowsBullsChallenge.projectState(state, "a").revealedSecrets?.b).toBe("GRAPE");
  });

  it("finishes an unsolved target after the guess cap and rewards defense", () => {
    let state = cowsBullsChallenge.createInitialState(players, context);
    state = accepted(state, { type: "set-secret", word: "APPLE" }, "a");
    state = accepted(state, { type: "set-secret", word: "GRAPE" }, "b");
    for (let index = 0; index < MAX_GUESSES_PER_TARGET; index += 1) {
      state = accepted(state, { type: "guess", targetPlayerId: "b", word: "BRAIN" }, "a");
      state = accepted(state, { type: "guess", targetPlayerId: "a", word: "CLOUD" }, "b");
    }
    expect(state.phase).toBe("results");
    expect(state.scores.a).toBe(70);
    expect(state.scores.b).toBe(70);
  });
});

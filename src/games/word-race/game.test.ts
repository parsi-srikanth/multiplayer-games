import { describe, expect, it } from "vitest";
import type { GameContext, PlayerView } from "../../shared/game-contract";
import { markWordleGuess, marksToEmoji } from "./feedback";
import { createWordRaceGame, WORD_RACE_MAX_GUESSES } from "./game";

const players: readonly PlayerView[] = [
  { id: "a", displayName: "Ada" },
  { id: "b", displayName: "Ben" },
];
const solo: readonly PlayerView[] = [{ id: "a", displayName: "Ada" }];
const at = (now: number): GameContext => ({ roomId: "ABCDE", now });

function guess(state: ReturnType<ReturnType<typeof createWordRaceGame>["createInitialState"]>, game: ReturnType<typeof createWordRaceGame>, actor: string, word: string, now: number) {
  const result = game.applyCommand(state, { type: "guess", word }, actor, at(now));
  if (!result.accepted) throw new Error(result.reason);
  return result.state;
}

describe("Word Race", () => {
  it("marks duplicate letters with Wordle semantics", () => {
    const marks = markWordleGuess("APPLE", "ALLEY");
    expect(marks).toEqual(["correct", "present", "absent", "present", "absent"]);
    expect(marksToEmoji(marks)).toBe("🟩🟨⬛🟨⬛");
  });

  it("supports solo completion and efficiency scoring", () => {
    const game = createWordRaceGame(() => "APPLE");
    let state = game.createInitialState(solo, at(0));
    state = guess(state, game, "a", "GRAPE", 10);
    state = guess(state, game, "a", "APPLE", 20);
    expect(state.phase).toBe("results");
    expect(state.scores.a).toBe(172);
    expect(game.projectState(state, "a")).toMatchObject({ placement: 1, secret: "APPLE" });
  });

  it("shows only abstract opponent patterns while racing", () => {
    const game = createWordRaceGame(() => "APPLE");
    let state = game.createInitialState(players, at(0));
    state = guess(state, game, "a", "GRAPE", 10);
    const bView = game.projectState(state, "b");
    expect(bView.opponents[0]?.patterns).toEqual(["⬛⬛🟨🟨🟩"]);
    expect(JSON.stringify(bView)).not.toContain("GRAPE");
    expect(bView.secret).toBeUndefined();
  });

  it("uses solve order and timestamp-backed state for multiplayer results", () => {
    const game = createWordRaceGame(() => "APPLE");
    let state = game.createInitialState(players, at(0));
    state = guess(state, game, "b", "APPLE", 50);
    state = guess(state, game, "a", "APPLE", 60);
    expect(state.phase).toBe("results");
    expect(state.solvedOrder).toEqual(["b", "a"]);
    expect(state.solvedAt).toEqual({ b: 50, a: 60 });
    expect(state.scores.b).toBe(180);
    expect(state.scores.a).toBe(170);
  });

  it("finishes when every player exhausts six valid guesses", () => {
    const game = createWordRaceGame(() => "APPLE");
    let state = game.createInitialState(solo, at(0));
    for (let attempt = 0; attempt < WORD_RACE_MAX_GUESSES; attempt += 1) {
      state = guess(state, game, "a", "BRAIN", attempt);
    }
    expect(state.phase).toBe("results");
    expect(state.scores.a).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import type { GameContext, PlayerView } from "../../shared/game-contract";
import { createCowsBullsClassicGame, createNumericSecret } from "./game";

const context: GameContext = { roomId: "ABCDE", now: 1 };
const solo: readonly PlayerView[] = [{ id: "a", displayName: "Ada" }];
const pair: readonly PlayerView[] = [...solo, { id: "b", displayName: "Ben" }];

function play(state: ReturnType<ReturnType<typeof createCowsBullsClassicGame>["createInitialState"]>, game: ReturnType<typeof createCowsBullsClassicGame>, actor: string, value: string) {
  const result = game.applyCommand(state, { type: "guess", value }, actor, context);
  if (!result.accepted) throw new Error(result.reason);
  return result.state;
}

describe("Cows & Bulls Classic", () => {
  it("generates a valid dictionary secret for word mode by default", () => {
    const game = createCowsBullsClassicGame({ mode: "word", maxAttempts: 8 });
    const state = game.createInitialState(solo, context);
    expect(state.secret).toMatch(/^[A-Z]{5}$/);
  });

  it("creates four distinct digits without a leading zero", () => {
    for (let count = 0; count < 25; count += 1) {
      const secret = createNumericSecret();
      expect(secret).toMatch(/^[1-9][0-9]{3}$/);
      expect(new Set(secret).size).toBe(4);
    }
  });

  it("supports a complete solo round and hides the secret while playing", () => {
    const game = createCowsBullsClassicGame({ mode: "digits", maxAttempts: 10 }, () => "1234");
    let state = game.createInitialState(solo, context);
    state = play(state, game, "a", "1243");
    const playingView = game.projectState(state, "a");
    expect(playingView.phase).toBe("playing");
    expect(playingView.secret).toBeUndefined();
    expect(playingView.guesses[0]).toMatchObject({ bulls: 2, cows: 2 });
    state = play(state, game, "a", "1234");
    expect(game.projectState(state, "a")).toMatchObject({ phase: "results", placement: 1, secret: "1234" });
    expect(state.scores.a).toBe(175);
  });

  it("runs a shared-secret multiplayer race without leaking opponent guesses", () => {
    const game = createCowsBullsClassicGame({ mode: "digits", maxAttempts: 2 }, () => "1234");
    let state = game.createInitialState(pair, context);
    state = play(state, game, "a", "1234");
    const bView = game.projectState(state, "b");
    expect(JSON.stringify(bView)).not.toContain('"value":"1234"');
    expect(bView.opponents[0]).toMatchObject({ attempts: 1, solved: true });
    state = play(state, game, "b", "5678");
    state = play(state, game, "b", "9012");
    expect(state.phase).toBe("results");
    expect(state.scores.a).toBe(180);
    expect(state.scores.b).toBe(0);
  });

  it("supports common-word mode with duplicate letters", () => {
    const game = createCowsBullsClassicGame({ mode: "word", maxAttempts: 6 }, () => "APPLE");
    let state = game.createInitialState(solo, context);
    state = play(state, game, "a", "ALLEY");
    expect(state.guesses.a?.[0]).toMatchObject({ bulls: 1, cows: 2 });
  });

  it("rejects repeated-digit and unknown-word guesses", () => {
    const digits = createCowsBullsClassicGame({ mode: "digits", maxAttempts: 6 }, () => "1234");
    const digitState = digits.createInitialState(solo, context);
    expect(digits.applyCommand(digitState, { type: "guess", value: "1123" }, "a", context)).toMatchObject({ accepted: false });

    const words = createCowsBullsClassicGame({ mode: "word", maxAttempts: 6 }, () => "APPLE");
    const wordState = words.createInitialState(solo, context);
    expect(words.applyCommand(wordState, { type: "guess", value: "ZZZZZ" }, "a", context)).toMatchObject({ accepted: false });
  });
});

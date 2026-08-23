import type { GameDefinition, PlayerId, PlayerView } from "../../shared/game-contract";
import { challengeWords, normalizeChallengeWord } from "../cows-bulls-challenge/dictionary";
import { scoreCowsAndBulls } from "../cows-bulls-challenge/scoring";
import type { CowsBullsFeedback } from "../cows-bulls-challenge/scoring";

export interface ClassicConfig {
  readonly mode: "digits" | "word";
  readonly maxAttempts: number;
}

export interface ClassicGuess extends CowsBullsFeedback {
  readonly value: string;
  readonly attempt: number;
}

export interface ClassicState {
  readonly players: readonly PlayerView[];
  readonly config: ClassicConfig;
  readonly secret: string;
  readonly guesses: Readonly<Record<PlayerId, readonly ClassicGuess[]>>;
  readonly solvedOrder: readonly PlayerId[];
  readonly scores: Readonly<Record<PlayerId, number>>;
  readonly phase: "playing" | "results";
}

export interface ClassicCommand {
  readonly type: "guess";
  readonly value: string;
}

export interface OpponentClassicProgress {
  readonly playerId: PlayerId;
  readonly displayName: string;
  readonly attempts: number;
  readonly solved: boolean;
  readonly exhausted: boolean;
}

export interface ClassicPublicState {
  readonly mode: ClassicConfig["mode"];
  readonly maxAttempts: number;
  readonly phase: ClassicState["phase"];
  readonly guesses: readonly ClassicGuess[];
  readonly opponents: readonly OpponentClassicProgress[];
  readonly scores: Readonly<Record<PlayerId, number>>;
  readonly placement?: number;
  readonly secret?: string;
}

function randomIndex(length: number): number {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
  return value % length;
}

export function createNumericSecret(): string {
  const digits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  for (let index = digits.length - 1; index > 0; index -= 1) {
    const selected = randomIndex(index + 1);
    [digits[index], digits[selected]] = [digits[selected] ?? "0", digits[index] ?? "0"];
  }
  if (digits[0] === "0") {
    const swap = 1 + randomIndex(9);
    [digits[0], digits[swap]] = [digits[swap] ?? "1", digits[0]];
  }
  return digits.slice(0, 4).join("");
}

function normalizeGuess(value: string, mode: ClassicConfig["mode"]): string | undefined {
  const normalized = value.trim().toUpperCase();
  if (mode === "digits") return /^(?!.*(.).*\1)[0-9]{4}$/.test(normalized) ? normalized : undefined;
  return normalizeChallengeWord(normalized);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isComplete(state: ClassicState, playerId: PlayerId): boolean {
  return state.solvedOrder.includes(playerId) || (state.guesses[playerId]?.length ?? 0) >= state.config.maxAttempts;
}

export function createCowsBullsClassicGame(
  config: ClassicConfig = { mode: "digits", maxAttempts: 10 },
  secretProvider?: () => string,
): GameDefinition<ClassicState, ClassicCommand, ClassicPublicState> {
  if (!Number.isSafeInteger(config.maxAttempts) || config.maxAttempts < 1 || config.maxAttempts > 20) {
    throw new Error("maxAttempts must be between 1 and 20.");
  }
  const resolvedSecretProvider = secretProvider ?? (config.mode === "digits"
    ? createNumericSecret
    : () => challengeWords[randomIndex(challengeWords.length)] ?? "APPLE");

  return {
    metadata: {
      id: "cows-bulls-classic",
      name: "Cows & Bulls Classic",
      description: "Crack the shared hidden code before everyone else.",
      minimumPlayers: 1,
      maximumPlayers: 4,
    },

    createInitialState(players: readonly PlayerView[]): ClassicState {
      if (players.length < 1 || players.length > 4) throw new Error("Classic requires 1–4 players.");
      const secret = resolvedSecretProvider().trim().toUpperCase();
      if (normalizeGuess(secret, config.mode) === undefined) throw new Error("Secret provider returned an invalid secret.");
      return {
        players,
        config,
        secret,
        guesses: Object.fromEntries(players.map((player) => [player.id, [] as readonly ClassicGuess[]])),
        solvedOrder: [],
        scores: Object.fromEntries(players.map((player) => [player.id, 0])),
        phase: "playing",
      };
    },

    validateCommand(value: unknown): value is ClassicCommand {
      return isRecord(value) && value.type === "guess" && typeof value.value === "string" && value.value.length <= 16;
    },

    applyCommand(state, command, actor) {
      if (state.phase !== "playing") return { accepted: false, reason: "Round is complete." };
      if (!state.players.some((player) => player.id === actor)) return { accepted: false, reason: "Unknown player." };
      if (isComplete(state, actor)) return { accepted: false, reason: "You already completed this round." };
      const guess = normalizeGuess(command.value, state.config.mode);
      if (guess === undefined) {
        return { accepted: false, reason: state.config.mode === "digits"
          ? "Enter four different digits."
          : "Enter a valid common five-letter word." };
      }
      const previous = state.guesses[actor] ?? [];
      const feedback = scoreCowsAndBulls(state.secret, guess);
      const record: ClassicGuess = { value: guess, attempt: previous.length + 1, ...feedback };
      const guesses = { ...state.guesses, [actor]: [...previous, record] };
      const solvedNow = feedback.bulls === state.secret.length;
      const placement = state.solvedOrder.length + 1;
      const solvedOrder = solvedNow ? [...state.solvedOrder, actor] : state.solvedOrder;
      const placementBonus = [30, 20, 10, 0][placement - 1] ?? 0;
      const earned = solvedNow ? 100 + Math.max(0, 50 - previous.length * 5) + placementBonus : 0;
      const scores = earned > 0 ? { ...state.scores, [actor]: earned } : state.scores;
      const next: ClassicState = { ...state, guesses, solvedOrder, scores };
      const phase = state.players.every((player) => isComplete(next, player.id)) ? "results" : "playing";
      return { accepted: true, state: { ...next, phase } };
    },

    projectState(state, viewer) {
      const guesses = state.guesses[viewer] ?? [];
      const placementIndex = state.solvedOrder.indexOf(viewer);
      return {
        mode: state.config.mode,
        maxAttempts: state.config.maxAttempts,
        phase: state.phase,
        guesses,
        opponents: state.players.filter((player) => player.id !== viewer).map((player) => ({
          playerId: player.id,
          displayName: player.displayName,
          attempts: state.guesses[player.id]?.length ?? 0,
          solved: state.solvedOrder.includes(player.id),
          exhausted: isComplete(state, player.id) && !state.solvedOrder.includes(player.id),
        })),
        scores: state.scores,
        ...(placementIndex < 0 ? {} : { placement: placementIndex + 1 }),
        ...(state.phase === "results" ? { secret: state.secret } : {}),
      };
    },
  };
}

export const cowsBullsClassic = createCowsBullsClassicGame();

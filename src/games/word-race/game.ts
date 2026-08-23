import type { GameDefinition, GameContext, PlayerId, PlayerView } from "../../shared/game-contract";
import { challengeWords, normalizeChallengeWord } from "../cows-bulls-challenge/dictionary";
import { markWordleGuess, marksToEmoji } from "./feedback";
import type { LetterMark } from "./feedback";

export const WORD_RACE_MAX_GUESSES = 6;

export interface WordRaceGuess {
  readonly word: string;
  readonly marks: readonly LetterMark[];
  readonly pattern: string;
}

export interface WordRaceState {
  readonly players: readonly PlayerView[];
  readonly secret: string;
  readonly guesses: Readonly<Record<PlayerId, readonly WordRaceGuess[]>>;
  readonly solvedOrder: readonly PlayerId[];
  readonly solvedAt: Readonly<Record<PlayerId, number>>;
  readonly scores: Readonly<Record<PlayerId, number>>;
  readonly phase: "playing" | "results";
}

export interface WordRaceCommand { readonly type: "guess"; readonly word: string }

export interface WordRaceOpponentProgress {
  readonly playerId: PlayerId;
  readonly displayName: string;
  readonly patterns: readonly string[];
  readonly solved: boolean;
  readonly attempts: number;
}

export interface WordRacePublicState {
  readonly phase: WordRaceState["phase"];
  readonly guesses: readonly WordRaceGuess[];
  readonly opponents: readonly WordRaceOpponentProgress[];
  readonly scores: Readonly<Record<PlayerId, number>>;
  readonly placement?: number;
  readonly secret?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function complete(state: WordRaceState, playerId: PlayerId): boolean {
  return state.solvedOrder.includes(playerId) || (state.guesses[playerId]?.length ?? 0) >= WORD_RACE_MAX_GUESSES;
}

function randomWord(): string {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
  return challengeWords[value % challengeWords.length] ?? "CRANE";
}

export function createWordRaceGame(secretProvider: () => string = randomWord): GameDefinition<WordRaceState, WordRaceCommand, WordRacePublicState> {
  return {
    metadata: {
      id: "word-race",
      name: "Word Race",
      description: "Solve the shared word while watching everyone's color trail.",
      minimumPlayers: 1,
      maximumPlayers: 4,
    },

    createInitialState(players: readonly PlayerView[]) {
      if (players.length < 1 || players.length > 4) throw new Error("Word Race requires 1–4 players.");
      const secret = normalizeChallengeWord(secretProvider());
      if (secret === undefined) throw new Error("Secret provider returned an invalid word.");
      return {
        players,
        secret,
        guesses: Object.fromEntries(players.map((player) => [player.id, [] as readonly WordRaceGuess[]])),
        solvedOrder: [],
        solvedAt: {},
        scores: Object.fromEntries(players.map((player) => [player.id, 0])),
        phase: "playing" as const,
      };
    },

    validateCommand(value: unknown): value is WordRaceCommand {
      return isRecord(value) && value.type === "guess" && typeof value.word === "string" && value.word.length <= 16;
    },

    applyCommand(state, command, actor, context: GameContext) {
      if (state.phase !== "playing") return { accepted: false, reason: "Race is complete." };
      if (!state.players.some((player) => player.id === actor)) return { accepted: false, reason: "Unknown player." };
      if (complete(state, actor)) return { accepted: false, reason: "You already completed this race." };
      const word = normalizeChallengeWord(command.word);
      if (word === undefined) return { accepted: false, reason: "Enter a valid common five-letter word." };
      const previous = state.guesses[actor] ?? [];
      const marks = markWordleGuess(state.secret, word);
      const guess: WordRaceGuess = { word, marks, pattern: marksToEmoji(marks) };
      const guesses = { ...state.guesses, [actor]: [...previous, guess] };
      const solvedNow = marks.every((mark) => mark === "correct");
      const placement = state.solvedOrder.length + 1;
      const solvedOrder = solvedNow ? [...state.solvedOrder, actor] : state.solvedOrder;
      const solvedAt = solvedNow ? { ...state.solvedAt, [actor]: context.now } : state.solvedAt;
      const placementBonus = [30, 20, 10, 0][placement - 1] ?? 0;
      const earned = solvedNow ? 100 + Math.max(0, 50 - previous.length * 8) + placementBonus : 0;
      const scores = earned > 0 ? { ...state.scores, [actor]: earned } : state.scores;
      const next: WordRaceState = { ...state, guesses, solvedOrder, solvedAt, scores };
      const phase = state.players.every((player) => complete(next, player.id)) ? "results" : "playing";
      return { accepted: true, state: { ...next, phase } };
    },

    projectState(state, viewer) {
      const placement = state.solvedOrder.indexOf(viewer);
      return {
        phase: state.phase,
        guesses: state.guesses[viewer] ?? [],
        opponents: state.players.filter((player) => player.id !== viewer).map((player) => ({
          playerId: player.id,
          displayName: player.displayName,
          patterns: (state.guesses[player.id] ?? []).map((guess) => guess.pattern),
          solved: state.solvedOrder.includes(player.id),
          attempts: state.guesses[player.id]?.length ?? 0,
        })),
        scores: state.scores,
        ...(placement < 0 ? {} : { placement: placement + 1 }),
        ...(state.phase === "results" ? { secret: state.secret } : {}),
      };
    },
    isComplete: (state) => state.phase === "results",
    getScores: (state) => state.scores,
  };
}

export const wordRace = createWordRaceGame();

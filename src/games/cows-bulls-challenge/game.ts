import type {
  GameDefinition,
  PlayerId,
  PlayerView,
} from "../../shared/game-contract";
import { normalizeChallengeWord } from "./dictionary";
import { scoreCowsAndBulls } from "./scoring";
import type { CowsBullsFeedback } from "./scoring";

export const MAX_GUESSES_PER_TARGET = 8;

export type ChallengePhase = "secrets" | "playing" | "results";

export interface GuessRecord extends CowsBullsFeedback {
  readonly guess: string;
  readonly attempt: number;
}

export interface ChallengeState {
  readonly players: readonly PlayerView[];
  readonly phase: ChallengePhase;
  readonly secrets: Readonly<Record<PlayerId, string>>;
  readonly guesses: Readonly<Record<PlayerId, Readonly<Record<PlayerId, readonly GuessRecord[]>>>>;
  readonly solved: Readonly<Record<PlayerId, readonly PlayerId[]>>;
  readonly firstSolver: Readonly<Record<PlayerId, PlayerId>>;
  readonly scores: Readonly<Record<PlayerId, number>>;
}

export type ChallengeCommand =
  | { readonly type: "set-secret"; readonly word: string }
  | { readonly type: "guess"; readonly targetPlayerId: PlayerId; readonly word: string };

export interface TargetProgress {
  readonly playerId: PlayerId;
  readonly displayName: string;
  readonly attempts: number;
  readonly solved: boolean;
  readonly exhausted: boolean;
  readonly guesses: readonly GuessRecord[];
  readonly secret?: string;
}

export interface ChallengePublicState {
  readonly phase: ChallengePhase;
  readonly lockedPlayerIds: readonly PlayerId[];
  readonly ownSecret?: string;
  readonly targets: readonly TargetProgress[];
  readonly scores: Readonly<Record<PlayerId, number>>;
  readonly revealedSecrets?: Readonly<Record<PlayerId, string>>;
}

function emptyPerPlayer<T>(players: readonly PlayerView[], value: () => T): Record<PlayerId, T> {
  return Object.fromEntries(players.map((player) => [player.id, value()]));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPlayer(state: ChallengeState, playerId: PlayerId): boolean {
  return state.players.some((player) => player.id === playerId);
}

function hasSolved(state: ChallengeState, attacker: PlayerId, target: PlayerId): boolean {
  return state.solved[attacker]?.includes(target) ?? false;
}

function guessesFor(state: ChallengeState, attacker: PlayerId, target: PlayerId): readonly GuessRecord[] {
  return state.guesses[attacker]?.[target] ?? [];
}

function attackIsComplete(state: ChallengeState, attacker: PlayerId, target: PlayerId): boolean {
  return hasSolved(state, attacker, target) || guessesFor(state, attacker, target).length >= MAX_GUESSES_PER_TARGET;
}

function allAttacksComplete(state: ChallengeState): boolean {
  return state.players.every((attacker) => state.players.every((target) =>
    attacker.id === target.id || attackIsComplete(state, attacker.id, target.id)));
}

function addDefenderScores(state: ChallengeState): Readonly<Record<PlayerId, number>> {
  const scores = { ...state.scores };
  for (const defender of state.players) {
    let failedGuesses = 0;
    let solvers = 0;
    for (const attacker of state.players) {
      if (attacker.id === defender.id) continue;
      const attempts = guessesFor(state, attacker.id, defender.id);
      const solved = hasSolved(state, attacker.id, defender.id);
      if (solved) solvers += 1;
      failedGuesses += attempts.length - (solved ? 1 : 0);
    }
    scores[defender.id] = (scores[defender.id] ?? 0) + Math.min(60, failedGuesses * 5) + (solvers === 0 ? 30 : 0);
  }
  return scores;
}

export const cowsBullsChallenge: GameDefinition<ChallengeState, ChallengeCommand, ChallengePublicState> = {
  metadata: {
    id: "cows-bulls-challenge",
    name: "Cows & Bulls: Player Challenge",
    description: "Lock a fair five-letter secret, then crack every opponent's word.",
    minimumPlayers: 2,
    maximumPlayers: 4,
  },

  createInitialState(players: readonly PlayerView[]): ChallengeState {
    if (players.length < 2 || players.length > 4) throw new Error("Player Challenge requires 2–4 players.");
    return {
      players,
      phase: "secrets",
      secrets: {},
      guesses: emptyPerPlayer(players, () => ({})),
      solved: emptyPerPlayer(players, () => []),
      firstSolver: {},
      scores: emptyPerPlayer(players, () => 0),
    };
  },

  validateCommand(value: unknown): value is ChallengeCommand {
    if (!isRecord(value) || typeof value.type !== "string") return false;
    if (value.type === "set-secret") return typeof value.word === "string" && value.word.length <= 16;
    return value.type === "guess" && typeof value.targetPlayerId === "string" &&
      value.targetPlayerId.length <= 64 && typeof value.word === "string" && value.word.length <= 16;
  },

  applyCommand(state, command, actor) {
    if (!isPlayer(state, actor)) return { accepted: false, reason: "Unknown player." };
    const word = normalizeChallengeWord(command.word);
    if (word === undefined) return { accepted: false, reason: "Choose a valid common five-letter word." };

    if (command.type === "set-secret") {
      if (state.phase !== "secrets") return { accepted: false, reason: "Secrets are already locked." };
      if (state.secrets[actor] !== undefined) return { accepted: false, reason: "Your secret is already locked." };
      const secrets = { ...state.secrets, [actor]: word };
      return {
        accepted: true,
        state: { ...state, secrets, phase: Object.keys(secrets).length === state.players.length ? "playing" : "secrets" },
      };
    }

    if (state.phase !== "playing") return { accepted: false, reason: "Guessing is not active." };
    const target = command.targetPlayerId;
    if (!isPlayer(state, target) || target === actor) return { accepted: false, reason: "Choose another player." };
    if (attackIsComplete(state, actor, target)) return { accepted: false, reason: "That target is already complete." };
    const secret = state.secrets[target];
    if (secret === undefined) return { accepted: false, reason: "Target secret is unavailable." };

    const previous = guessesFor(state, actor, target);
    const feedback = scoreCowsAndBulls(secret, word);
    const record: GuessRecord = { guess: word, attempt: previous.length + 1, ...feedback };
    const guesses = {
      ...state.guesses,
      [actor]: { ...state.guesses[actor], [target]: [...previous, record] },
    };
    const solvedNow = feedback.bulls === 5;
    const solved = solvedNow
      ? { ...state.solved, [actor]: [...(state.solved[actor] ?? []), target] }
      : state.solved;
    const firstSolver = solvedNow && state.firstSolver[target] === undefined
      ? { ...state.firstSolver, [target]: actor }
      : state.firstSolver;
    const attackPoints = solvedNow ? 100 + Math.max(0, 40 - previous.length * 5) +
      (state.firstSolver[target] === undefined ? 20 : 0) : 0;
    const scores = attackPoints > 0
      ? { ...state.scores, [actor]: (state.scores[actor] ?? 0) + attackPoints }
      : state.scores;
    const next: ChallengeState = { ...state, guesses, solved, firstSolver, scores };
    return allAttacksComplete(next)
      ? { accepted: true, state: { ...next, phase: "results", scores: addDefenderScores(next) } }
      : { accepted: true, state: next };
  },

  projectState(state, viewer) {
    const targets = state.players.filter((player) => player.id !== viewer).map((player) => {
      const guesses = guessesFor(state, viewer, player.id);
      const base: TargetProgress = {
        playerId: player.id,
        displayName: player.displayName,
        attempts: guesses.length,
        solved: hasSolved(state, viewer, player.id),
        exhausted: guesses.length >= MAX_GUESSES_PER_TARGET,
        guesses,
      };
      const secret = state.secrets[player.id];
      return state.phase === "results" && secret !== undefined ? { ...base, secret } : base;
    });
    return {
      phase: state.phase,
      lockedPlayerIds: Object.keys(state.secrets),
      ...(state.secrets[viewer] === undefined ? {} : { ownSecret: state.secrets[viewer] }),
      targets,
      scores: state.scores,
      ...(state.phase === "results" ? { revealedSecrets: state.secrets } : {}),
    };
  },
};

export { challengeDictionarySize, isChallengeWord, normalizeChallengeWord } from "./dictionary";
export { cowsBullsChallenge, MAX_GUESSES_PER_TARGET } from "./game";
export type {
  ChallengeCommand,
  ChallengePhase,
  ChallengePublicState,
  ChallengeState,
  GuessRecord,
  TargetProgress,
} from "./game";
export { scoreCowsAndBulls } from "./scoring";
export type { CowsBullsFeedback } from "./scoring";

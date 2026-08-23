export interface CowsBullsFeedback {
  readonly bulls: number;
  readonly cows: number;
}

export function scoreCowsAndBulls(secret: string, guess: string): CowsBullsFeedback {
  if (secret.length !== guess.length) throw new Error("Secret and guess lengths must match.");

  let bulls = 0;
  const secretCounts = new Map<string, number>();
  const unmatchedGuess: string[] = [];

  for (let index = 0; index < secret.length; index += 1) {
    const secretLetter = secret[index];
    const guessLetter = guess[index];
    if (secretLetter === undefined || guessLetter === undefined) continue;
    if (secretLetter === guessLetter) {
      bulls += 1;
    } else {
      secretCounts.set(secretLetter, (secretCounts.get(secretLetter) ?? 0) + 1);
      unmatchedGuess.push(guessLetter);
    }
  }

  let cows = 0;
  for (const letter of unmatchedGuess) {
    const available = secretCounts.get(letter) ?? 0;
    if (available > 0) {
      cows += 1;
      secretCounts.set(letter, available - 1);
    }
  }
  return { bulls, cows };
}

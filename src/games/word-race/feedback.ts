export type LetterMark = "correct" | "present" | "absent";

export function markWordleGuess(secret: string, guess: string): readonly LetterMark[] {
  if (secret.length !== guess.length) throw new Error("Secret and guess lengths must match.");
  const marks: LetterMark[] = Array.from({ length: secret.length }, () => "absent");
  const counts = new Map<string, number>();

  for (let index = 0; index < secret.length; index += 1) {
    const expected = secret[index];
    const actual = guess[index];
    if (expected === undefined || actual === undefined) continue;
    if (expected === actual) marks[index] = "correct";
    else counts.set(expected, (counts.get(expected) ?? 0) + 1);
  }
  for (let index = 0; index < guess.length; index += 1) {
    if (marks[index] === "correct") continue;
    const letter = guess[index];
    if (letter === undefined) continue;
    const available = counts.get(letter) ?? 0;
    if (available > 0) {
      marks[index] = "present";
      counts.set(letter, available - 1);
    }
  }
  return marks;
}

export function marksToEmoji(marks: readonly LetterMark[]): string {
  return marks.map((mark) => mark === "correct" ? "🟩" : mark === "present" ? "🟨" : "⬛").join("");
}

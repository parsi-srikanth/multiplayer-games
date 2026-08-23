/** Client-safe deployment manifest. Contains identifiers only, never server rule modules or secrets. */
export const implementedGameIds: ReadonlySet<string> = new Set([
  "cows-bulls-challenge",
  "cows-bulls-classic",
  "word-race",
  "tic-tac-toe-plus",
  "dots-boxes",
  "connect-four",
  "sudoku-sprint",
] as const);

import { cowsBullsChallenge } from "./cows-bulls-challenge";
import { cowsBullsClassic } from "./cows-bulls-classic";
import { wordRace } from "./word-race";
import { ticTacToePlus } from "./tic-tac-toe-plus";
import { dotsBoxes } from "./dots-boxes";
import { connectFour } from "./connect-four";
import { sudokuSprint } from "./sudoku-sprint";
import { GameRegistry } from "./runtime-registry";
export type { RuntimeGame } from "./runtime-registry";
export { GameRegistry } from "./runtime-registry";

/** Server-only authoritative registry. Never import this module from client code. */
export const gameRegistry = new GameRegistry();
gameRegistry.register(cowsBullsChallenge);
gameRegistry.register(cowsBullsClassic);
gameRegistry.register(wordRace);
gameRegistry.register(ticTacToePlus);
gameRegistry.register(dotsBoxes);
gameRegistry.register(connectFour);
gameRegistry.register(sudokuSprint);

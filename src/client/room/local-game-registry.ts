import { GameRegistry } from "../../games/runtime-registry";
import { cowsBullsClassic } from "../../games/cows-bulls-classic";
import { wordRace } from "../../games/word-race";

/** Browser-local registry contains only games explicitly supported offline; no multiplayer-only rules or secrets. */
export const localGameRegistry = new GameRegistry();
localGameRegistry.register(cowsBullsClassic);
localGameRegistry.register(wordRace);

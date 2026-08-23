import { PracticeGameView } from "../../game-framework/PracticeGameView";
import type { ClientGameModule } from "../../game-framework/types";

const game: ClientGameModule = {
  metadata: { id: "word-race", name: "Word Race", description: "Solve the same five-letter word in the fewest guesses.", shortDescription: "Solve the same five-letter word in the fewest guesses.", minimumPlayers: 1, maximumPlayers: 4, estimatedMinutes: 8, accent: "mint", icon: "W", supportsSolo: true },
  View: PracticeGameView,
};

export default game;

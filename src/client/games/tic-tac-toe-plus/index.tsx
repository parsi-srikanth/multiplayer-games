import { PracticeGameView } from "../../game-framework/PracticeGameView";
import type { ClientGameModule } from "../../game-framework/types";

const game: ClientGameModule = {
  metadata: { id: "tic-tac-toe-plus", name: "Tic-Tac-Toe+", description: "Classic three-in-a-row or a larger four-player board.", shortDescription: "Classic three-in-a-row or a larger four-player board.", minimumPlayers: 1, maximumPlayers: 4, estimatedMinutes: 5, accent: "sky", icon: "×", supportsSolo: true },
  View: PracticeGameView,
};

export default game;

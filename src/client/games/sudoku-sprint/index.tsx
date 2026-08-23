import { PracticeGameView } from "../../game-framework/PracticeGameView";
import type { ClientGameModule } from "../../game-framework/types";

const game: ClientGameModule = {
  metadata: { id: "sudoku-sprint", name: "Sudoku Sprint", description: "Race through the same puzzle with accuracy first.", shortDescription: "Race through the same puzzle with accuracy first.", minimumPlayers: 1, maximumPlayers: 4, estimatedMinutes: 12, accent: "sky", icon: "9", supportsSolo: true },
  View: PracticeGameView,
};

export default game;

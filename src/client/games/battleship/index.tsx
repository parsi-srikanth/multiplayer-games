import { PracticeGameView } from "../../game-framework/PracticeGameView";
import type { ClientGameModule } from "../../game-framework/types";

export default {
  metadata: { id: "battleship", name: "Battleship", shortDescription: "Call the coordinates and sink the hidden fleet.", description: "A tactical hidden-grid guessing game.", minimumPlayers: 2, maximumPlayers: 2, estimatedMinutes: 15, accent: "sky", icon: "⚓", supportsSolo: false },
  View: PracticeGameView,
} satisfies ClientGameModule;

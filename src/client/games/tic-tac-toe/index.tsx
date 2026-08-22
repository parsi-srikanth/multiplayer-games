import { PracticeGameView } from "../../game-framework/PracticeGameView";
import type { ClientGameModule } from "../../game-framework/types";

export default {
  metadata: { id: "tic-tac-toe", name: "Tic-Tac-Toe", shortDescription: "Three in a row, no setup required.", description: "The familiar quick grid game.", minimumPlayers: 2, maximumPlayers: 2, estimatedMinutes: 3, accent: "sky", icon: "×○", supportsSolo: true },
  View: PracticeGameView,
} satisfies ClientGameModule;

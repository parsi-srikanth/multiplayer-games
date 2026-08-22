import { PracticeGameView } from "../../game-framework/PracticeGameView";
import type { ClientGameModule } from "../../game-framework/types";

export default {
  metadata: { id: "reversi", name: "Reversi", shortDescription: "Trap and flip your rival's pieces.", description: "An elegant board game of shifting control.", minimumPlayers: 2, maximumPlayers: 2, estimatedMinutes: 10, accent: "mint", icon: "◐", supportsSolo: true },
  View: PracticeGameView,
} satisfies ClientGameModule;

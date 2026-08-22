import { PracticeGameView } from "../../game-framework/PracticeGameView";
import type { ClientGameModule } from "../../game-framework/types";

export default {
  metadata: { id: "checkers", name: "Checkers", shortDescription: "Jump, crown, and clear the board.", description: "The classic diagonal strategy game.", minimumPlayers: 2, maximumPlayers: 2, estimatedMinutes: 12, accent: "coral", icon: "◆", supportsSolo: true },
  View: PracticeGameView,
} satisfies ClientGameModule;

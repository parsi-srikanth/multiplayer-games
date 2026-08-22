import { PracticeGameView } from "../../game-framework/PracticeGameView";
import type { ClientGameModule } from "../../game-framework/types";

export default {
  metadata: { id: "pictionary", name: "Pictionary", shortDescription: "Sketch clues while everyone races to guess.", description: "Fast collaborative drawing and guessing.", minimumPlayers: 3, maximumPlayers: 12, estimatedMinutes: 15, accent: "coral", icon: "✎", supportsSolo: false },
  View: PracticeGameView,
} satisfies ClientGameModule;

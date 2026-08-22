import { PracticeGameView } from "../../game-framework/PracticeGameView";
import type { ClientGameModule } from "../../game-framework/types";

export default {
  metadata: { id: "word-chain", name: "Word Chain", shortDescription: "Keep the chain alive with a connected word.", description: "A quick-thinking vocabulary party game.", minimumPlayers: 2, maximumPlayers: 10, estimatedMinutes: 8, accent: "gold", icon: "↝", supportsSolo: false },
  View: PracticeGameView,
} satisfies ClientGameModule;

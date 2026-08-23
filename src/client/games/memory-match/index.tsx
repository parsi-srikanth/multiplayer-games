import { PracticeGameView } from "../../game-framework/PracticeGameView";
import type { ClientGameModule } from "../../game-framework/types";

const game: ClientGameModule = {
  metadata: { id: "memory-match", name: "Memory Match", description: "Find matching symbol pairs and build the highest score.", shortDescription: "Find matching symbol pairs and build the highest score.", minimumPlayers: 1, maximumPlayers: 4, estimatedMinutes: 8, accent: "violet", icon: "✦", supportsSolo: true },
  View: PracticeGameView,
};

export default game;

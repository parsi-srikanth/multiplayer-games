import { PracticeGameView } from "../../game-framework/PracticeGameView";
import type { ClientGameModule } from "../../game-framework/types";

export default {
  metadata: { id: "chess", name: "Chess", shortDescription: "A timeless battle of plans and pieces.", description: "Classic chess for two players.", minimumPlayers: 2, maximumPlayers: 2, estimatedMinutes: 20, accent: "violet", icon: "♞", supportsSolo: true },
  View: PracticeGameView,
} satisfies ClientGameModule;

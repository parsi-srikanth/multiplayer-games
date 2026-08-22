import { PracticeGameView } from "../../game-framework/PracticeGameView";
import type { ClientGameModule } from "../../game-framework/types";

export default {
  metadata: { id: "trivia", name: "Trivia", shortDescription: "Quick questions, surprising answers, bragging rights.", description: "A lively multiplayer knowledge challenge.", minimumPlayers: 1, maximumPlayers: 12, estimatedMinutes: 10, accent: "violet", icon: "?", supportsSolo: true },
  View: PracticeGameView,
} satisfies ClientGameModule;

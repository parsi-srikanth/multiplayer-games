import { PracticeGameView } from "../../game-framework/PracticeGameView";
import type { ClientGameModule } from "../../game-framework/types";

const game: ClientGameModule = {
  metadata: { id: "trivia-blitz", name: "Trivia Blitz", description: "Answer quick questions where correctness beats speed.", shortDescription: "Answer quick questions where correctness beats speed.", minimumPlayers: 1, maximumPlayers: 4, estimatedMinutes: 10, accent: "gold", icon: "?", supportsSolo: true },
  View: PracticeGameView,
};

export default game;

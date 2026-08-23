import { PracticeGameView } from "../../game-framework/PracticeGameView";
import type { ClientGameModule } from "../../game-framework/types";

const game: ClientGameModule = {
  metadata: { id: "connect-four", name: "Connect Four", description: "Drop discs and connect four before your opponent.", shortDescription: "Drop discs and connect four before your opponent.", minimumPlayers: 1, maximumPlayers: 2, estimatedMinutes: 8, accent: "gold", icon: "●", supportsSolo: true },
  View: PracticeGameView,
};

export default game;

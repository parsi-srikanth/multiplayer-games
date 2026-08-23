import { PracticeGameView } from "../../game-framework/PracticeGameView";
import type { ClientGameModule } from "../../game-framework/types";

const game: ClientGameModule = {
  metadata: { id: "cows-bulls-classic", name: "Cows & Bulls Classic", description: "Crack the shared secret before your rivals.", shortDescription: "Crack the shared secret before your rivals.", minimumPlayers: 1, maximumPlayers: 4, estimatedMinutes: 8, accent: "coral", icon: "◎", supportsSolo: true },
  View: PracticeGameView,
};

export default game;

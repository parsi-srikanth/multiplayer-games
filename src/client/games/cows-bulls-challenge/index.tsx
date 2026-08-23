import { PracticeGameView } from "../../game-framework/PracticeGameView";
import type { ClientGameModule } from "../../game-framework/types";

const game: ClientGameModule = {
  metadata: { id: "cows-bulls-challenge", name: "Cows & Bulls: Player Challenge", description: "Set a secret, solve every rival's, and defend your own.", shortDescription: "Set a secret, solve every rival's, and defend your own.", minimumPlayers: 2, maximumPlayers: 4, estimatedMinutes: 12, accent: "violet", icon: "◇", supportsSolo: false },
  View: PracticeGameView,
};

export default game;

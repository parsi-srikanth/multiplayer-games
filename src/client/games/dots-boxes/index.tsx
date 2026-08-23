import { PracticeGameView } from "../../game-framework/PracticeGameView";
import type { ClientGameModule } from "../../game-framework/types";

const game: ClientGameModule = {
  metadata: { id: "dots-boxes", name: "Dots & Boxes", description: "Claim edges, complete boxes, and keep your turn.", shortDescription: "Claim edges, complete boxes, and keep your turn.", minimumPlayers: 1, maximumPlayers: 4, estimatedMinutes: 10, accent: "coral", icon: "□", supportsSolo: true },
  View: PracticeGameView,
};

export default game;

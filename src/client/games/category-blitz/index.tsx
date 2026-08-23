import { PracticeGameView } from "../../game-framework/PracticeGameView";
import type { ClientGameModule } from "../../game-framework/types";

const game: ClientGameModule = {
  metadata: { id: "category-blitz", name: "Category Blitz", description: "Race the timer to fill every category for one letter.", shortDescription: "Race the timer to fill every category for one letter.", minimumPlayers: 1, maximumPlayers: 4, estimatedMinutes: 10, accent: "mint", icon: "A", supportsSolo: true },
  View: PracticeGameView,
};

export default game;

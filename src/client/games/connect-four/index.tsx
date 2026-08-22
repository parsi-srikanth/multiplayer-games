import { PracticeGameView } from "../../game-framework/PracticeGameView";
import type { ClientGameModule } from "../../game-framework/types";

export default {
  metadata: { id: "connect-four", name: "Connect Four", shortDescription: "Drop discs and line up four before your rival.", description: "A quick vertical strategy game.", minimumPlayers: 2, maximumPlayers: 2, estimatedMinutes: 6, accent: "gold", icon: "●", supportsSolo: true },
  View: PracticeGameView,
} satisfies ClientGameModule;

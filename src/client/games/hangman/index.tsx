import { PracticeGameView } from "../../game-framework/PracticeGameView";
import type { ClientGameModule } from "../../game-framework/types";

export default {
  metadata: { id: "hangman", name: "Hangman", shortDescription: "Guess the word one letter at a time.", description: "A friendly word deduction game.", minimumPlayers: 1, maximumPlayers: 8, estimatedMinutes: 5, accent: "mint", icon: "Aa", supportsSolo: true },
  View: PracticeGameView,
} satisfies ClientGameModule;

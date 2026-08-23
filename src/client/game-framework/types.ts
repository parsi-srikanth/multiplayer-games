import type { ComponentType } from "react";
import type { GameId, GameMetadata } from "../../shared/game-contract";

export type GameAccent = "coral" | "gold" | "mint" | "sky" | "violet";

export interface ClientGameMetadata extends GameMetadata {
  readonly shortDescription: string;
  readonly estimatedMinutes: number;
  readonly accent: GameAccent;
  readonly icon: string;
  readonly supportsSolo: boolean;
}

export interface GameViewProps {
  readonly gameId: GameId;
  readonly roomId: string;
  readonly playerName: string;
  readonly state: unknown;
  readonly sendCommand: (command: unknown) => Promise<void>;
  readonly onFinish: () => void;
}

export interface ClientGameModule {
  readonly metadata: ClientGameMetadata;
  readonly View: ComponentType<GameViewProps>;
}

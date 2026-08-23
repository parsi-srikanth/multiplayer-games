import type { GameDefinition, PlayerId, PlayerView } from "../../shared/game-contract";

export const BOX_ROWS = 3;
export const BOX_COLUMNS = 3;
export const EDGE_COUNT = 24;
export type EdgeOrientation = "h" | "v";
export interface DotsBoxesCommand { readonly type: "claim-edge"; readonly orientation: EdgeOrientation; readonly row: number; readonly column: number }
export interface DotsBoxesState {
  readonly players: readonly PlayerView[];
  readonly edges: Readonly<Record<string, PlayerId>>;
  readonly boxes: Readonly<Record<string, PlayerId>>;
  readonly currentPlayerId: PlayerId;
}
export interface DotsBoxesPublicState extends DotsBoxesState { readonly scores: Readonly<Record<PlayerId, number>> }

function edgeId(orientation: EdgeOrientation, row: number, column: number): string { return `${orientation}-${String(row)}-${String(column)}`; }
function boxId(row: number, column: number): string { return `${String(row)}-${String(column)}`; }
function integer(value: unknown): value is number { return typeof value === "number" && Number.isInteger(value); }
function parseCommand(value: unknown): DotsBoxesCommand | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const command = value as Record<string, unknown>;
  if (command.type !== "claim-edge" || (command.orientation !== "h" && command.orientation !== "v") || !integer(command.row) || !integer(command.column)) return null;
  const valid = command.orientation === "h"
    ? command.row >= 0 && command.row <= BOX_ROWS && command.column >= 0 && command.column < BOX_COLUMNS
    : command.row >= 0 && command.row < BOX_ROWS && command.column >= 0 && command.column <= BOX_COLUMNS;
  return valid ? { type: "claim-edge", orientation: command.orientation, row: command.row, column: command.column } : null;
}
function adjacentBoxes(command: DotsBoxesCommand): readonly (readonly [number, number])[] {
  const candidates: readonly (readonly [number, number])[] = command.orientation === "h"
    ? [[command.row - 1, command.column], [command.row, command.column]]
    : [[command.row, command.column - 1], [command.row, command.column]];
  return candidates.filter(([row, column]) => row >= 0 && row < BOX_ROWS && column >= 0 && column < BOX_COLUMNS);
}
function boxComplete(edges: Readonly<Record<string, PlayerId>>, row: number, column: number): boolean {
  return edges[edgeId("h", row, column)] !== undefined && edges[edgeId("h", row + 1, column)] !== undefined
    && edges[edgeId("v", row, column)] !== undefined && edges[edgeId("v", row, column + 1)] !== undefined;
}
function scores(state: DotsBoxesState): Readonly<Record<PlayerId, number>> {
  return Object.fromEntries(state.players.map((player) => [player.id, Object.values(state.boxes).filter((owner) => owner === player.id).length]));
}

export const dotsBoxes: GameDefinition<DotsBoxesState, DotsBoxesCommand, DotsBoxesPublicState> = {
  metadata: { id: "dots-boxes", name: "Dots & Boxes", description: "Claim edges, complete boxes, and keep the turn when you score.", minimumPlayers: 2, maximumPlayers: 4 },
  createInitialState(players) {
    const first = players[0];
    if (first === undefined || players.length < 2 || players.length > 4) throw new Error("Dots & Boxes requires two to four players.");
    return { players: [...players], edges: {}, boxes: {}, currentPlayerId: first.id };
  },
  validateCommand(command): command is DotsBoxesCommand { return parseCommand(command) !== null; },
  applyCommand(state, rawCommand, actor) {
    const command = parseCommand(rawCommand);
    if (command === null) return { accepted: false, reason: "Choose a valid edge." };
    if (Object.keys(state.edges).length >= EDGE_COUNT) return { accepted: false, reason: "The game is complete." };
    if (actor !== state.currentPlayerId) return { accepted: false, reason: "Wait for your turn." };
    const id = edgeId(command.orientation, command.row, command.column);
    if (state.edges[id] !== undefined) return { accepted: false, reason: "That edge is already claimed." };
    const edges = { ...state.edges, [id]: actor };
    const boxes = { ...state.boxes };
    let completed = 0;
    for (const [row, column] of adjacentBoxes(command)) {
      const idForBox = boxId(row, column);
      if (boxes[idForBox] === undefined && boxComplete(edges, row, column)) { boxes[idForBox] = actor; completed += 1; }
    }
    const index = state.players.findIndex((player) => player.id === actor);
    const next = state.players[(index + 1) % state.players.length];
    return { accepted: true, state: { ...state, edges, boxes, currentPlayerId: completed > 0 || next === undefined ? actor : next.id } };
  },
  projectState(state) { return { ...state, scores: scores(state) }; },
  isComplete(state) { return Object.keys(state.edges).length >= EDGE_COUNT; },
  getScores: scores,
};

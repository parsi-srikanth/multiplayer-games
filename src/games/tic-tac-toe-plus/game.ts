import type { GameDefinition, PlayerId, PlayerView } from "../../shared/game-contract";

export const BOARD_SIZE = 4;
export const CONNECT_LENGTH = 3;

export interface TicTacToePlusState {
  readonly players: readonly PlayerView[];
  readonly board: readonly (PlayerId | null)[];
  readonly currentPlayerId: PlayerId;
  readonly winnerId: PlayerId | null;
  readonly draw: boolean;
}

export interface TicTacToePlusPublicState {
  readonly board: readonly (PlayerId | null)[];
  readonly currentPlayerId: PlayerId;
  readonly winnerId: PlayerId | null;
  readonly draw: boolean;
  readonly players: readonly PlayerView[];
}

export interface TicTacToePlusCommand { readonly type: "place"; readonly index: number }

const lines: readonly (readonly number[])[] = (() => {
  const result: number[][] = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) for (let start = 0; start <= BOARD_SIZE - CONNECT_LENGTH; start += 1)
    result.push(Array.from({ length: CONNECT_LENGTH }, (_, offset) => row * BOARD_SIZE + start + offset));
  for (let column = 0; column < BOARD_SIZE; column += 1) for (let start = 0; start <= BOARD_SIZE - CONNECT_LENGTH; start += 1)
    result.push(Array.from({ length: CONNECT_LENGTH }, (_, offset) => (start + offset) * BOARD_SIZE + column));
  for (let row = 0; row <= BOARD_SIZE - CONNECT_LENGTH; row += 1) for (let column = 0; column <= BOARD_SIZE - CONNECT_LENGTH; column += 1) {
    result.push(Array.from({ length: CONNECT_LENGTH }, (_, offset) => (row + offset) * BOARD_SIZE + column + offset));
    result.push(Array.from({ length: CONNECT_LENGTH }, (_, offset) => (row + offset) * BOARD_SIZE + column + CONNECT_LENGTH - 1 - offset));
  }
  return result;
})();

function hasWon(board: readonly (PlayerId | null)[], playerId: PlayerId): boolean {
  return lines.some((line) => line.every((index) => board[index] === playerId));
}

function parseCommand(command: unknown): TicTacToePlusCommand {
  if (typeof command !== "object" || command === null || Array.isArray(command)) throw new Error("Invalid move.");
  const value = command as Record<string, unknown>;
  if (value.type !== "place" || !Number.isInteger(value.index) || Number(value.index) < 0 || Number(value.index) >= BOARD_SIZE * BOARD_SIZE)
    throw new Error("Choose an open square.");
  return { type: "place", index: Number(value.index) };
}

export const ticTacToePlus: GameDefinition<TicTacToePlusState, TicTacToePlusCommand, TicTacToePlusPublicState> = {
  metadata: { id: "tic-tac-toe-plus", name: "Tic-Tac-Toe+", description: "A 4×4 board where three in a row wins.", minimumPlayers: 2, maximumPlayers: 2 },
  createInitialState(players) {
    if (players.length !== 2) throw new Error("Tic-Tac-Toe+ requires two players.");
    const first = players[0];
    if (first === undefined) throw new Error("Tic-Tac-Toe+ requires two players.");
    return { players: [...players], board: Array<null>(BOARD_SIZE * BOARD_SIZE).fill(null), currentPlayerId: first.id, winnerId: null, draw: false };
  },
  validateCommand(command): command is TicTacToePlusCommand {
    try { parseCommand(command); return true; } catch { return false; }
  },
  applyCommand(state, rawCommand, actor) {
    const command = parseCommand(rawCommand);
    if (state.winnerId !== null || state.draw) return { accepted: false, reason: "The game is complete." };
    if (actor !== state.currentPlayerId) return { accepted: false, reason: "Wait for your turn." };
    if (state.board[command.index] !== null) return { accepted: false, reason: "That square is occupied." };
    const board = [...state.board]; board[command.index] = actor;
    const winnerId = hasWon(board, actor) ? actor : null;
    const draw = winnerId === null && board.every((cell) => cell !== null);
    const other = state.players.find((player) => player.id !== actor);
    return { accepted: true, state: { ...state, board, winnerId, draw, currentPlayerId: winnerId === null && !draw && other !== undefined ? other.id : actor } };
  },
  projectState(state) { return { board: state.board, currentPlayerId: state.currentPlayerId, winnerId: state.winnerId, draw: state.draw, players: state.players }; },
  isComplete(state) { return state.winnerId !== null || state.draw; },
  getScores(state) {
    return Object.fromEntries(state.players.map((player) => [player.id, state.winnerId === player.id ? 3 : state.draw ? 1 : 0]));
  },
};

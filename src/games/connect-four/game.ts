import type { GameDefinition, PlayerId, PlayerView } from "../../shared/game-contract";
export const ROWS = 6; export const COLUMNS = 7;
export interface ConnectFourState { readonly players: readonly PlayerView[]; readonly board: readonly (PlayerId | null)[]; readonly currentPlayerId: PlayerId; readonly winnerId: PlayerId | null; readonly complete: boolean }
export interface ConnectFourCommand { readonly type: "drop"; readonly column: number }
function win(board: readonly (PlayerId | null)[], player: PlayerId, row: number, column: number): boolean {
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]] as const) {
    let count = 1;
    for (const direction of [-1, 1] as const) for (let step = 1; step < 4; step += 1) {
      const r = row + dr * step * direction; const c = column + dc * step * direction;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLUMNS || board[r * COLUMNS + c] !== player) break;
      count += 1;
    }
    if (count >= 4) return true;
  }
  return false;
}
export const connectFour: GameDefinition<ConnectFourState, ConnectFourCommand, ConnectFourState> = {
  metadata: { id: "connect-four", name: "Connect Four", description: "Drop discs and connect four before your opponent.", minimumPlayers: 2, maximumPlayers: 2 },
  createInitialState(players) { if (players.length !== 2) throw new Error("Connect Four requires exactly two players."); const first = players[0]; if (first === undefined) throw new Error("Missing first player."); return { players: [...players], board: Array<PlayerId | null>(ROWS * COLUMNS).fill(null), currentPlayerId: first.id, winnerId: null, complete: false }; },
  validateCommand(value): value is ConnectFourCommand { if (typeof value !== "object" || value === null || Array.isArray(value)) return false; const v = value as Record<string, unknown>; return Object.keys(v).length === 2 && v.type === "drop" && Number.isInteger(v.column) && Number(v.column) >= 0 && Number(v.column) < COLUMNS; },
  applyCommand(state, command, actor) {
    if (state.complete) return { accepted: false, reason: "The game is already complete." };
    if (actor !== state.currentPlayerId) return { accepted: false, reason: "It is not your turn." };
    if (!state.players.some((p) => p.id === actor)) return { accepted: false, reason: "You are not a player in this game." };
    let row = ROWS - 1; while (row >= 0 && state.board[row * COLUMNS + command.column] !== null) row -= 1;
    if (row < 0) return { accepted: false, reason: "That column is full." };
    const board = [...state.board]; board[row * COLUMNS + command.column] = actor;
    const winner = win(board, actor, row, command.column); const complete = winner || board.every((cell) => cell !== null);
    const next = state.players.find((p) => p.id !== actor); if (next === undefined) throw new Error("Missing opponent.");
    return { accepted: true, state: { ...state, board, winnerId: winner ? actor : null, complete, currentPlayerId: complete ? actor : next.id } };
  },
  projectState(state) { return { ...state, board: [...state.board], players: [...state.players] }; },
  isComplete: (state) => state.complete,
  getScores(state) { return Object.fromEntries(state.players.map((p) => [p.id, state.winnerId === p.id ? 1 : 0])); },
};

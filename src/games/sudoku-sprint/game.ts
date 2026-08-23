import type { GameDefinition, PlayerId, PlayerView } from "../../shared/game-contract";
const SIZE = 4;
const SOLUTION = [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1] as const;
const PUZZLE = [1, 0, 0, 4, 0, 4, 1, 0, 2, 0, 4, 0, 0, 3, 0, 1] as const;
export interface SudokuPlayerState { readonly board: readonly number[]; readonly mistakes: number; readonly completedAt: number | null }
export interface SudokuSprintState { readonly players: readonly PlayerView[]; readonly puzzle: readonly number[]; readonly playerStates: Readonly<Record<PlayerId, SudokuPlayerState>>; readonly winnerId: PlayerId | null }
export interface SudokuSprintCommand { readonly type: "place"; readonly row: number; readonly column: number; readonly value: number }
export interface SudokuSprintPublicState { readonly puzzle: readonly number[]; readonly board: readonly number[]; readonly mistakes: number; readonly progress: Readonly<Record<PlayerId, number>>; readonly players: readonly PlayerView[]; readonly winnerId: PlayerId | null; readonly complete: boolean }
function validCommand(value: unknown): value is SudokuSprintCommand { if (typeof value !== "object" || value === null || Array.isArray(value)) return false; const v = value as Record<string, unknown>; return Object.keys(v).length === 4 && v.type === "place" && Number.isInteger(v.row) && Number(v.row) >= 0 && Number(v.row) < SIZE && Number.isInteger(v.column) && Number(v.column) >= 0 && Number(v.column) < SIZE && Number.isInteger(v.value) && Number(v.value) >= 1 && Number(v.value) <= SIZE; }
function progress(board: readonly number[]): number { return board.filter((value) => value !== 0).length; }
export const sudokuSprint: GameDefinition<SudokuSprintState, SudokuSprintCommand, SudokuSprintPublicState> = {
  metadata: { id: "sudoku-sprint", name: "Sudoku Sprint", description: "Solve a compact Sudoku first, with mistakes tracked by the server.", minimumPlayers: 1, maximumPlayers: 4 },
  createInitialState(players) { if (players.length < 1 || players.length > 4) throw new Error("Sudoku Sprint requires one to four players."); return { players: [...players], puzzle: [...PUZZLE], playerStates: Object.fromEntries(players.map((player) => [player.id, { board: [...PUZZLE], mistakes: 0, completedAt: null }])), winnerId: null }; },
  validateCommand: validCommand,
  applyCommand(state, command, actor, context) {
    if (state.winnerId !== null) return { accepted: false, reason: "The sprint is complete." };
    const player = state.playerStates[actor]; if (player === undefined) return { accepted: false, reason: "You are not a player in this sprint." };
    const index = command.row * SIZE + command.column;
    if (state.puzzle[index] !== 0) return { accepted: false, reason: "That clue cannot be changed." };
    if (player.board[index] !== 0) return { accepted: false, reason: "That cell is already filled." };
    const correct = SOLUTION[index] === command.value;
    const board = correct ? player.board.map((value, cell) => cell === index ? command.value : value) : [...player.board];
    const solved = board.every((value, cell) => value === SOLUTION[cell]);
    const updated: SudokuPlayerState = { board, mistakes: player.mistakes + (correct ? 0 : 1), completedAt: solved ? context.now : null };
    return { accepted: true, state: { ...state, playerStates: { ...state.playerStates, [actor]: updated }, winnerId: solved ? actor : null } };
  },
  projectState(state, viewer) { const mine = state.playerStates[viewer]; if (mine === undefined) throw new Error("Missing viewer state."); return { puzzle: [...state.puzzle], board: [...mine.board], mistakes: mine.mistakes, progress: Object.fromEntries(Object.entries(state.playerStates).map(([id, value]) => [id, progress(value.board)])), players: [...state.players], winnerId: state.winnerId, complete: state.winnerId !== null }; },
  isComplete: (state) => state.winnerId !== null,
  getScores(state) { return Object.fromEntries(state.players.map((player) => { const value = state.playerStates[player.id]; return [player.id, state.winnerId === player.id ? Math.max(10, 100 - (value?.mistakes ?? 0) * 10) : 0]; })); },
};

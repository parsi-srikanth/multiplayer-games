import type { GameDefinition, PlayerId, PlayerView } from "../../shared/game-contract";
const SIZE = 4;
const CLUE_CELLS = new Set([0, 3, 5, 6, 8, 10, 13, 15]);
export interface SudokuPlayerState { readonly board: readonly number[]; readonly mistakes: number; readonly completedAt: number | null }
export interface SudokuSprintState { readonly players: readonly PlayerView[]; readonly puzzle: readonly number[]; readonly solution: readonly number[]; readonly playerStates: Readonly<Record<PlayerId, SudokuPlayerState>>; readonly winnerId: PlayerId | null }
export interface SudokuSprintCommand { readonly type: "place"; readonly row: number; readonly column: number; readonly value: number }
export interface SudokuSprintPublicState { readonly puzzle: readonly number[]; readonly board: readonly number[]; readonly mistakes: number; readonly progress: Readonly<Record<PlayerId, number>>; readonly players: readonly PlayerView[]; readonly winnerId: PlayerId | null; readonly complete: boolean }
function validCommand(value: unknown): value is SudokuSprintCommand { if (typeof value !== "object" || value === null || Array.isArray(value)) return false; const v = value as Record<string, unknown>; return Object.keys(v).length === 4 && v.type === "place" && Number.isInteger(v.row) && Number(v.row) >= 0 && Number(v.row) < SIZE && Number.isInteger(v.column) && Number(v.column) >= 0 && Number(v.column) < SIZE && Number.isInteger(v.value) && Number(v.value) >= 1 && Number(v.value) <= SIZE; }
function progress(board: readonly number[]): number { return board.filter((value) => value !== 0).length; }
function createPuzzle(): { readonly puzzle: readonly number[]; readonly solution: readonly number[] } {
  const permutations: number[][] = [];
  function visit(prefix: number[], remaining: number[]): void {
    if (remaining.length === 0) { permutations.push(prefix); return; }
    remaining.forEach((value, index) => { visit([...prefix, value], remaining.filter((_, candidate) => candidate !== index)); });
  }
  visit([], [1, 2, 3, 4]);
  const byte = new Uint8Array(1); const acceptanceLimit = Math.floor(256 / permutations.length) * permutations.length;
  do { crypto.getRandomValues(byte); } while ((byte[0] ?? 0) >= acceptanceLimit);
  const digits = permutations[(byte[0] ?? 0) % permutations.length];
  if (digits === undefined) throw new Error("Unable to generate Sudoku digits.");
  const solution = Array.from({ length: SIZE * SIZE }, (_, index) => {
    const value = digits[(index % SIZE + Math.floor(index / SIZE) * 2 + Math.floor(Math.floor(index / SIZE) / 2)) % SIZE];
    if (value === undefined) throw new Error("Unable to generate Sudoku solution.");
    return value;
  });
  return { solution, puzzle: solution.map((value, index) => CLUE_CELLS.has(index) ? value : 0) };
}
export const sudokuSprint: GameDefinition<SudokuSprintState, SudokuSprintCommand, SudokuSprintPublicState> = {
  metadata: { id: "sudoku-sprint", name: "Sudoku Sprint", description: "Solve a compact Sudoku first, with mistakes tracked by the server.", minimumPlayers: 1, maximumPlayers: 4 },
  createInitialState(players) { if (players.length < 1 || players.length > 4) throw new Error("Sudoku Sprint requires one to four players."); const { puzzle, solution } = createPuzzle(); return { players: [...players], puzzle, solution, playerStates: Object.fromEntries(players.map((player) => [player.id, { board: [...puzzle], mistakes: 0, completedAt: null }])), winnerId: null }; },
  validateCommand: validCommand,
  applyCommand(state, command, actor, context) {
    if (state.winnerId !== null) return { accepted: false, reason: "The sprint is complete." };
    const player = state.playerStates[actor]; if (player === undefined) return { accepted: false, reason: "You are not a player in this sprint." };
    const index = command.row * SIZE + command.column;
    if (state.puzzle[index] !== 0) return { accepted: false, reason: "That clue cannot be changed." };
    if (player.board[index] !== 0) return { accepted: false, reason: "That cell is already filled." };
    const correct = state.solution[index] === command.value;
    const board = correct ? player.board.map((value, cell) => cell === index ? command.value : value) : [...player.board];
    const solved = board.every((value, cell) => value === state.solution[cell]);
    const updated: SudokuPlayerState = { board, mistakes: player.mistakes + (correct ? 0 : 1), completedAt: solved ? context.now : null };
    return { accepted: true, state: { ...state, playerStates: { ...state.playerStates, [actor]: updated }, winnerId: solved ? actor : null } };
  },
  projectState(state, viewer) { const mine = state.playerStates[viewer]; if (mine === undefined) throw new Error("Missing viewer state."); return { puzzle: [...state.puzzle], board: [...mine.board], mistakes: mine.mistakes, progress: Object.fromEntries(Object.entries(state.playerStates).map(([id, value]) => [id, progress(value.board)])), players: [...state.players], winnerId: state.winnerId, complete: state.winnerId !== null }; },
  isComplete: (state) => state.winnerId !== null,
  getScores(state) { return Object.fromEntries(state.players.map((player) => { const value = state.playerStates[player.id]; return [player.id, state.winnerId === player.id ? Math.max(10, 100 - (value?.mistakes ?? 0) * 10) : 0]; })); },
};

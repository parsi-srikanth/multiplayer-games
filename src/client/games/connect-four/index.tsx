import { useState } from "react";
import type { ClientGameModule, GameViewProps } from "../../game-framework/types";
function record(v: unknown): v is Record<string, unknown> { return typeof v === "object" && v !== null && !Array.isArray(v); }
// eslint-disable-next-line react-refresh/only-export-components
function View({ state, playerId, sendCommand }: GameViewProps) {
  const [error, setError] = useState("");
  if (!record(state) || !Array.isArray(state.board) || !Array.isArray(state.players)) return <p role="status">Preparing the board…</p>;
  const board = state.board as readonly (string | null)[]; const players = state.players.filter(record); const turn = state.currentPlayerId === playerId; const complete = state.complete === true;
  const symbol = (id: unknown) => id === null ? "" : players.findIndex((p) => p.id === id) === 0 ? "●" : "○";
  async function drop(column: number) { setError(""); try { await sendCommand({ type: "drop", column }); } catch (e) { setError(e instanceof Error ? e.message : "Move rejected."); } }
  return <section className="form-panel" aria-labelledby="connect-heading"><h2 id="connect-heading">Connect four discs.</h2><p role="status">{complete ? state.winnerId === null ? "Draw" : "Four connected!" : turn ? "Your turn" : "Opponent’s turn"}</p><div className="connect-controls" aria-label="Choose a column">{Array.from({ length: 7 }, (_, c) => <button key={c} type="button" aria-label={`Drop in column ${String(c + 1)}`} disabled={!turn || complete || board[c] !== null} onClick={() => { void drop(c); }}>↓</button>)}</div><div className="connect-board" aria-label="Connect Four board">{board.map((cell, i) => <span key={i} className={`connect-cell ${cell === null ? "" : "filled"}`} aria-label={cell === null ? "Empty" : symbol(cell)}>{symbol(cell)}</span>)}</div>{error !== "" && <p role="alert">{error}</p>}</section>;
}
const game: ClientGameModule = { metadata: { id: "connect-four", name: "Connect Four", description: "Take turns dropping discs into seven columns.", shortDescription: "Drop four in a row.", minimumPlayers: 2, maximumPlayers: 2, estimatedMinutes: 8, icon: "●", accent: "gold", supportsSolo: false }, View };
export default game;

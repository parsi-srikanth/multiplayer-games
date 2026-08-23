import { useState } from "react";
import type { ClientGameModule, GameViewProps } from "../../game-framework/types";
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
// eslint-disable-next-line react-refresh/only-export-components
function View({ state, playerId, sendCommand }: GameViewProps) {
  const [error, setError] = useState("");
  if (!record(state) || !Array.isArray(state.board) || !Array.isArray(state.players)) return <p role="status">Preparing the board…</p>;
  const board = state.board as readonly (string | null)[];
  const players = state.players.filter(record);
  const turn = state.currentPlayerId === playerId;
  const complete = state.complete === true;
  function playerIndex(id: unknown): number { return players.findIndex((player) => player.id === id); }
  function playerName(id: unknown): string {
    const value = players.find((player) => player.id === id)?.displayName;
    return typeof value === "string" ? value : "Player";
  }
  function symbol(id: unknown): string { return playerIndex(id) === 0 ? "●" : "○"; }
  async function drop(column: number) { setError(""); try { await sendCommand({ type: "drop", column }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Move rejected."); } }
  return <section className="form-panel" aria-labelledby="connect-heading">
    <h2 id="connect-heading">Connect four discs.</h2>
    <p role="status">{complete ? state.winnerId === null ? "Draw" : `${playerName(state.winnerId)} connected four!` : turn ? "Your turn" : `${playerName(state.currentPlayerId)}'s turn`}</p>
    <ul className="connect-legend" aria-label="Player discs">{players.map((player, index) => { const id = typeof player.id === "string" ? player.id : String(index); return <li key={id}><span aria-hidden="true">{index === 0 ? "●" : "○"}</span>{playerName(id)}</li>; })}</ul>
    <div className="connect-controls" aria-label="Choose a column">{Array.from({ length: 7 }, (_, column) => <button key={column} type="button" aria-label={`Drop in column ${String(column + 1)}`} disabled={!turn || complete || board[column] !== null} onClick={() => { void drop(column); }}>↓</button>)}</div>
    <div className="connect-board" role="grid" aria-label="Connect Four board" aria-rowcount={6} aria-colcount={7}>{board.map((cell, index) => { const row = Math.floor(index / 7) + 1; const column = index % 7 + 1; return <span key={index} role="gridcell" aria-rowindex={row} aria-colindex={column} aria-label={cell === null ? `Row ${String(row)}, column ${String(column)}, empty` : `Row ${String(row)}, column ${String(column)}, ${playerName(cell)} disc`} className={`connect-cell ${cell === null ? "" : "filled"}`}><span aria-hidden="true">{cell === null ? "" : symbol(cell)}</span></span>; })}</div>
    {error !== "" && <p role="alert">{error}</p>}
  </section>;
}
const game: ClientGameModule = { metadata: { id: "connect-four", name: "Connect Four", description: "Take turns dropping discs into seven columns.", shortDescription: "Drop four in a row.", minimumPlayers: 2, maximumPlayers: 2, estimatedMinutes: 8, icon: "●", accent: "gold", supportsSolo: false }, View };
export default game;

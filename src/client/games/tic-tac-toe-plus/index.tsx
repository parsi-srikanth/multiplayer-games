import { useState } from "react";
import type { ClientGameModule, GameViewProps } from "../../game-framework/types";

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }

// eslint-disable-next-line react-refresh/only-export-components
function TicTacToePlusView({ state, playerId, sendCommand }: GameViewProps) {
  const [error, setError] = useState("");
  if (!isRecord(state) || !Array.isArray(state.board) || !Array.isArray(state.players))
    return <section className="form-panel" role="status"><h2>Preparing the board…</h2></section>;
  const players = state.players.filter(isRecord);
  const symbols = new Map(players.map((player, index) => [typeof player.id === "string" ? player.id : "", index === 0 ? "X" : "O"]));
  const currentPlayerId = typeof state.currentPlayerId === "string" ? state.currentPlayerId : "";
  const winnerId = typeof state.winnerId === "string" ? state.winnerId : null;
  const complete = winnerId !== null || state.draw === true;
  const winner = players.find((player) => player.id === winnerId);
  const currentNameValue = players.find((player) => player.id === currentPlayerId)?.displayName;
  const currentName = typeof currentNameValue === "string" ? currentNameValue : "Opponent";
  const winnerName = typeof winner?.displayName === "string" ? winner.displayName : "Player";
  const status = winner !== undefined ? `${winnerName} wins` : state.draw === true ? "Draw" : currentPlayerId === playerId ? "Your turn" : `${currentName}'s turn`;
  async function place(index: number) {
    setError("");
    try { await sendCommand({ type: "place", index }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Move rejected."); }
  }
  return <section className="form-panel" aria-labelledby="ttt-heading">
    <h2 id="ttt-heading">Four by four. Three in a row wins.</h2><p role="status">{status}</p>
    <div className="square-board square-board-4" role="grid" aria-label="Tic-Tac-Toe+ board">{state.board.map((cell, index) => {
      const symbol = typeof cell === "string" ? symbols.get(cell) ?? "?" : "";
      const row = Math.floor(index / 4) + 1; const column = index % 4 + 1;
      return <button className="square-cell" role="gridcell" type="button" key={String(index)} aria-label={symbol === "" ? `Row ${String(row)}, column ${String(column)}, empty` : `Row ${String(row)}, column ${String(column)}, ${symbol}`} disabled={complete || currentPlayerId !== playerId || cell !== null} onClick={() => { void place(index); }}>{symbol}</button>;
    })}</div>
    {error !== "" && <p className="form-error" role="alert">{error}</p>}
  </section>;
}

const game: ClientGameModule = {
  metadata: { id: "tic-tac-toe-plus", name: "Tic-Tac-Toe+", description: "Play a faster 4×4 twist where three in a row wins.", shortDescription: "Play a faster 4×4 twist where three in a row wins.", minimumPlayers: 2, maximumPlayers: 2, estimatedMinutes: 5, accent: "sky", icon: "✕", supportsSolo: false },
  View: TicTacToePlusView,
};

export default game;

import { useState } from "react";
import type { ClientGameModule, GameViewProps } from "../../game-framework/types";

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }

// eslint-disable-next-line react-refresh/only-export-components
function DotsBoxesView({ state, playerId, sendCommand }: GameViewProps) {
  const [error, setError] = useState("");
  if (!isRecord(state) || !isRecord(state.edges) || !isRecord(state.boxes) || !Array.isArray(state.players))
    return <section className="form-panel" role="status"><h2>Drawing the board…</h2></section>;
  const players = state.players.filter(isRecord);
  const currentId = typeof state.currentPlayerId === "string" ? state.currentPlayerId : "";
  const currentNameValue = players.find((player) => player.id === currentId)?.displayName;
  const currentName = typeof currentNameValue === "string" ? currentNameValue : "Player";
  const complete = Object.keys(state.edges).length >= 24;
  const palette = new Map(players.map((player, index) => [typeof player.id === "string" ? player.id : "", `player-${String(index + 1)}`]));
  async function claim(orientation: "h" | "v", row: number, column: number) {
    setError("");
    try { await sendCommand({ type: "claim-edge", orientation, row, column }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Edge rejected."); }
  }
  const cells = [];
  for (let gridRow = 0; gridRow < 7; gridRow += 1) for (let gridColumn = 0; gridColumn < 7; gridColumn += 1) {
    const key = `${String(gridRow)}-${String(gridColumn)}`;
    if (gridRow % 2 === 0 && gridColumn % 2 === 0) { cells.push(<span className="dot" aria-hidden="true" key={key} />); continue; }
    if (gridRow % 2 === 1 && gridColumn % 2 === 1) {
      const box = `${String((gridRow - 1) / 2)}-${String((gridColumn - 1) / 2)}`; const owner = state.boxes[box];
      cells.push(<span className={`box ${typeof owner === "string" ? palette.get(owner) ?? "" : ""}`} aria-label={typeof owner === "string" ? "Claimed box" : "Open box"} key={key} />); continue;
    }
    const orientation = gridRow % 2 === 0 ? "h" : "v";
    const row = orientation === "h" ? gridRow / 2 : (gridRow - 1) / 2;
    const column = orientation === "h" ? (gridColumn - 1) / 2 : gridColumn / 2;
    const edge = `${orientation}-${String(row)}-${String(column)}`; const owner = state.edges[edge];
    cells.push(<button className={`edge edge-${orientation} ${typeof owner === "string" ? palette.get(owner) ?? "claimed" : ""}`} type="button" key={key} aria-label={`${typeof owner === "string" ? "Claimed" : "Open"} ${orientation === "h" ? "horizontal" : "vertical"} edge, row ${String(row + 1)}, column ${String(column + 1)}`} disabled={complete || currentId !== playerId || typeof owner === "string"} onClick={() => { void claim(orientation, row, column); }} />);
  }
  return <section className="form-panel" aria-labelledby="dots-heading"><h2 id="dots-heading">Complete boxes to keep your turn.</h2><p role="status">{complete ? "Board complete" : currentId === playerId ? "Your turn" : `${currentName}'s turn`}</p><div className="dots-board" aria-label="Dots and Boxes board">{cells}</div>{error !== "" && <p className="form-error" role="alert">{error}</p>}</section>;
}

const game: ClientGameModule = {
  metadata: { id: "dots-boxes", name: "Dots & Boxes", description: "Claim edges, close boxes, and build the biggest territory.", shortDescription: "Claim edges, close boxes, and build the biggest territory.", minimumPlayers: 2, maximumPlayers: 4, estimatedMinutes: 10, accent: "coral", icon: "□", supportsSolo: false },
  View: DotsBoxesView,
};
export default game;

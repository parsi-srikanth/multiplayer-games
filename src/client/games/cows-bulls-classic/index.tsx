import { useState } from "react";
import type { SyntheticEvent } from "react";
import type { ClientGameModule, GameViewProps } from "../../game-framework/types";

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }

// eslint-disable-next-line react-refresh/only-export-components
function ClassicView({ state, sendCommand }: GameViewProps) {
  const [guess, setGuess] = useState("");
  const [error, setError] = useState("");
  if (!isRecord(state)) return <section className="form-panel" role="status"><h2>Preparing the secret…</h2></section>;
  const mode = state.mode === "word" ? "word" : "digits";
  const guesses = Array.isArray(state.guesses) ? state.guesses.filter(isRecord) : [];
  const opponents = Array.isArray(state.opponents) ? state.opponents.filter(isRecord) : [];
  const phase = state.phase === "results" ? "results" : "playing";
  async function submit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault(); setError("");
    try { await sendCommand({ type: "guess", value: guess }); setGuess(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Guess rejected."); }
  }
  return <section className="form-panel" aria-labelledby="classic-heading">
    <h2 id="classic-heading">{phase === "results" ? `Secret: ${typeof state.secret === "string" ? state.secret : ""}` : `Crack the ${mode === "word" ? "five-letter word" : "four-digit code"}`}</h2>
    {phase === "playing" && <form onSubmit={(event) => { void submit(event); }}><label>Your guess<input aria-label="Your guess" autoCapitalize="characters" autoComplete="off" inputMode={mode === "digits" ? "numeric" : "text"} maxLength={mode === "digits" ? 4 : 5} value={guess} onChange={(event) => { setGuess(event.target.value.toUpperCase()); }} required /></label>{error !== "" && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary" type="submit">Check guess</button></form>}
    <ol className="player-list" aria-label="Your guesses">{guesses.map((item, index) => <li key={`${String(item.value)}-${String(index)}`}><strong>{String(item.value)}</strong><span>{String(item.bulls)} bulls · {String(item.cows)} cows</span></li>)}</ol>
    {opponents.length > 0 && <aside><h3>Other players</h3><ul className="player-list">{opponents.map((item) => <li key={String(item.playerId)}><strong>{String(item.displayName)}</strong><span>{String(item.attempts)} guesses{item.solved === true ? " · solved" : ""}</span></li>)}</ul></aside>}
  </section>;
}

const game: ClientGameModule = {
  metadata: { id: "cows-bulls-classic", name: "Cows & Bulls Classic", description: "Crack the shared hidden code before everyone else.", shortDescription: "Crack the shared hidden code before everyone else.", minimumPlayers: 1, maximumPlayers: 4, estimatedMinutes: 8, accent: "coral", icon: "◎", supportsSolo: true },
  View: ClassicView,
};

export default game;

import { useState } from "react";
import type { SyntheticEvent } from "react";
import type { ClientGameModule, GameViewProps } from "../../game-framework/types";

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }

// eslint-disable-next-line react-refresh/only-export-components
function WordRaceView({ state, sendCommand }: GameViewProps) {
  const [word, setWord] = useState("");
  const [error, setError] = useState("");
  if (!isRecord(state)) return <section className="form-panel" role="status"><h2>Choosing a word…</h2></section>;
  const guesses = Array.isArray(state.guesses) ? state.guesses.filter(isRecord) : [];
  const opponents = Array.isArray(state.opponents) ? state.opponents.filter(isRecord) : [];
  async function submit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault(); setError("");
    try { await sendCommand({ type: "guess", word }); setWord(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Guess rejected."); }
  }
  return <section className="form-panel" aria-labelledby="word-race-heading">
    <h2 id="word-race-heading">{state.phase === "results" ? `Word: ${typeof state.secret === "string" ? state.secret : ""}` : "Find the five-letter word"}</h2>
    {state.phase !== "results" && <form onSubmit={(event) => { void submit(event); }}><label>Your word<input aria-label="Your word" autoCapitalize="characters" autoComplete="off" maxLength={5} value={word} onChange={(event) => { setWord(event.target.value.toUpperCase()); }} required /></label>{error !== "" && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary" type="submit">Submit word</button></form>}
    <ol className="player-list" aria-label="Your word guesses">{guesses.map((item, index) => <li key={`${String(item.word)}-${String(index)}`}><strong>{String(item.word)}</strong><span aria-label={Array.isArray(item.marks) ? item.marks.map(String).join(", ") : "feedback"}>{typeof item.pattern === "string" ? item.pattern : ""}</span></li>)}</ol>
    {opponents.length > 0 && <aside><h3>Race progress</h3><ul className="player-list">{opponents.map((item) => <li key={String(item.playerId)}><strong>{String(item.displayName)}</strong><span>{String(item.attempts)} guesses{item.solved === true ? " · solved" : ""}</span></li>)}</ul></aside>}
  </section>;
}

const game: ClientGameModule = {
  metadata: { id: "word-race", name: "Word Race", description: "Solve the shared word while everyone races beside you.", shortDescription: "Solve the shared word while everyone races beside you.", minimumPlayers: 1, maximumPlayers: 4, estimatedMinutes: 6, accent: "gold", icon: "W", supportsSolo: true },
  View: WordRaceView,
};

export default game;

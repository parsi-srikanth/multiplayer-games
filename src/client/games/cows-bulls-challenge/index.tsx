import { useMemo, useState } from "react";
import type { SyntheticEvent } from "react";
import type { ClientGameModule, GameViewProps } from "../../game-framework/types";

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }

// eslint-disable-next-line react-refresh/only-export-components
function ChallengeView({ state, sendCommand }: GameViewProps) {
  const [word, setWord] = useState("");
  const [selectedTarget, setSelectedTarget] = useState("");
  const [error, setError] = useState("");
  const targets = useMemo(() => isRecord(state) && Array.isArray(state.targets) ? state.targets.filter(isRecord) : [], [state]);
  const suggestedTarget = targets.find((target) => target.solved !== true && target.exhausted !== true)?.playerId;
  const targetId = selectedTarget || (typeof suggestedTarget === "string" ? suggestedTarget : "");
  if (!isRecord(state)) return <section className="form-panel" role="status"><h2>Preparing challenges…</h2></section>;
  async function submitSecret(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault(); setError("");
    try { await sendCommand({ type: "set-secret", word }); setWord(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Secret rejected."); }
  }
  async function submitGuess(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault(); setError("");
    try { await sendCommand({ type: "guess", targetPlayerId: targetId, word }); setWord(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Guess rejected."); }
  }
  if (state.phase === "secrets") return <section className="form-panel" aria-labelledby="secret-heading"><h2 id="secret-heading">Choose your secret word</h2>{typeof state.ownSecret === "string" ? <p role="status">Secret locked. Waiting for the other players.</p> : <form onSubmit={(event) => { void submitSecret(event); }}><label>Five-letter secret<input aria-label="Five-letter secret" autoCapitalize="characters" autoComplete="off" maxLength={5} value={word} onChange={(event) => { setWord(event.target.value.toUpperCase()); }} required /></label>{error !== "" && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary" type="submit">Lock secret</button></form>}</section>;
  return <section className="form-panel" aria-labelledby="challenge-heading">
    <h2 id="challenge-heading">{state.phase === "results" ? "Challenge results" : "Solve every rival’s word"}</h2>
    {state.phase === "playing" && targets.length > 0 && <form onSubmit={(event) => { void submitGuess(event); }}><label>Target<select value={targetId} onChange={(event) => { setSelectedTarget(event.target.value); }}>{targets.map((target) => <option key={String(target.playerId)} value={String(target.playerId)} disabled={target.solved === true || target.exhausted === true}>{String(target.displayName)}</option>)}</select></label><label>Your guess<input aria-label="Your guess" autoCapitalize="characters" autoComplete="off" maxLength={5} value={word} onChange={(event) => { setWord(event.target.value.toUpperCase()); }} required /></label>{error !== "" && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary" type="submit" disabled={targetId === ""}>Guess word</button></form>}
    <div>{targets.map((target) => <article key={String(target.playerId)}><h3>{String(target.displayName)} {target.solved === true ? "— solved" : target.exhausted === true ? "— complete" : ""}</h3><ol className="player-list">{(Array.isArray(target.guesses) ? target.guesses.filter(isRecord) : []).map((guess, index) => <li key={`${String(guess.guess)}-${String(index)}`}><strong>{String(guess.guess)}</strong><span>{String(guess.bulls)} bulls · {String(guess.cows)} cows</span></li>)}</ol>{typeof target.secret === "string" && <p>Secret: <strong>{target.secret}</strong></p>}</article>)}</div>
  </section>;
}

const game: ClientGameModule = {
  metadata: { id: "cows-bulls-challenge", name: "Cows & Bulls: Player Challenge", description: "Set a secret, solve every rival's, and defend your own.", shortDescription: "Set a secret, solve every rival's, and defend your own.", minimumPlayers: 2, maximumPlayers: 4, estimatedMinutes: 12, accent: "violet", icon: "◇", supportsSolo: false },
  View: ChallengeView,
};

export default game;

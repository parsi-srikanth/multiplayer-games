import type { ReactNode, SyntheticEvent } from "react";
import { useState } from "react";
import { clientGames } from "../game-framework/catalog";
import type { ClientGameMetadata } from "../game-framework/types";
import { AppLink } from "../router";
import type { ConnectionStatus, RoomPlayer } from "../room/transport";

export function PageShell({ children, roomStatus }: { readonly children: ReactNode; readonly roomStatus: ConnectionStatus | undefined }) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <AppLink className="brand" to="/" aria-label="Parsi Games home">Parsi Games</AppLink>
        <nav aria-label="Primary navigation">
          <AppLink to="/join">Join room</AppLink>
          {roomStatus !== undefined && <ConnectionBadge status={roomStatus} />}
        </nav>
      </header>
      <main id="main-content">{children}</main>
      <footer><span>Made for game night.</span><span>No account needed.</span></footer>
    </div>
  );
}

export function ConnectionBadge({ status }: { readonly status: ConnectionStatus }) {
  const label = status === "connected" ? "Connected" : status === "connecting" ? "Connecting" : status === "reconnecting" ? "Reconnecting" : "Offline";
  return <span className={`connection connection-${status}`} role="status"><span aria-hidden="true" />{label}</span>;
}

export function GameCard({ game, action }: { readonly game: ClientGameMetadata; readonly action?: ReactNode }) {
  return (
    <article className={`game-card accent-${game.accent}`}>
      <span className="game-icon" aria-hidden="true">{game.icon}</span>
      <div>
        <h3>{game.name}</h3>
        <p>{game.shortDescription}</p>
        <p className="game-meta">{game.minimumPlayers}–{game.maximumPlayers} players · {game.estimatedMinutes} min</p>
      </div>
      {action}
    </article>
  );
}

export function GamePicker({ selectedId, onChange, soloOnly = false }: {
  readonly selectedId: string;
  readonly onChange: (gameId: string) => void;
  readonly soloOnly?: boolean;
}) {
  const games = soloOnly ? clientGames.filter((game) => game.metadata.supportsSolo) : clientGames;
  return (
    <fieldset className="game-picker">
      <legend>Choose a game</legend>
      <div className="picker-grid">
        {games.map(({ metadata }) => (
          <label key={metadata.id} className={`picker-option accent-${metadata.accent}`}>
            <input type="radio" name="game" value={metadata.id} checked={selectedId === metadata.id} onChange={() => { onChange(metadata.id); }} />
            <span className="game-icon" aria-hidden="true">{metadata.icon}</span>
            <span><strong>{metadata.name}</strong><small>{metadata.estimatedMinutes} min · up to {metadata.maximumPlayers}</small></span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function DisplayNameForm({ title, submitLabel, initialName, roomId, onSubmit }: {
  readonly title: string;
  readonly submitLabel: string;
  readonly initialName: string;
  readonly roomId: string | undefined;
  readonly onSubmit: (name: string, roomId?: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState(roomId ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      setError("Use at least 2 characters for your display name.");
      return;
    }
    setError("");
    setPending(true);
    try {
      await onSubmit(cleanName, roomId ?? code);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong. Try again.");
      setPending(false);
    }
  }

  return (
    <form className="form-panel" onSubmit={(event) => { void submit(event); }}>
      <h1>{title}</h1>
      <p>Your name is saved only on this device for next time.</p>
      {roomId === undefined && (
        <label>Room code<input autoCapitalize="characters" autoComplete="off" inputMode="text" maxLength={16} value={code} onChange={(event) => { setCode(event.target.value.toUpperCase()); }} placeholder="PLAY-42" required /></label>
      )}
      <label>Display name<input autoComplete="nickname" maxLength={24} value={name} onChange={(event) => { setName(event.target.value); }} placeholder="Your name" required /></label>
      {error !== "" && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-primary" type="submit" disabled={pending}>{pending ? "Joining…" : submitLabel}</button>
    </form>
  );
}

export function Scoreboard({ players, heading = "Scoreboard" }: { readonly players: readonly RoomPlayer[]; readonly heading?: string }) {
  const sorted = [...players].sort((left, right) => right.score - left.score);
  if (sorted.length === 0) return <section className="empty-state"><h2>{heading}</h2><p>No scores yet. Invite a player to get started.</p></section>;
  return (
    <section className="scoreboard" aria-labelledby="scoreboard-title">
      <h2 id="scoreboard-title">{heading}</h2>
      <ol>{sorted.map((player, index) => <li key={player.id}><span><b>{index + 1}</b>{player.displayName}</span><strong>{player.score}<span className="sr-only"> points</span></strong></li>)}</ol>
    </section>
  );
}

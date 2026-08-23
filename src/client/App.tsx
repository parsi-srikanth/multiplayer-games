import { useEffect, useState } from "react";
import { clientGames, getClientGame, getGameMetadata } from "./game-framework/catalog";
import { AppLink, navigate, useRoute } from "./router";
import { HybridRoomTransport } from "./room/transport";
import type { RoomSnapshot, RoomTransport } from "./room/transport";
import { DisplayNameForm, GameCard, GamePicker, PageShell, Scoreboard } from "./components/shared";

const defaultTransport = new HybridRoomTransport();
const DISPLAY_NAME_KEY = "parsi-games-display-name";

function useDisplayName(): readonly [string, (name: string) => void] {
  const [displayName, setDisplayNameState] = useState(() => localStorage.getItem(DISPLAY_NAME_KEY) ?? "");
  const setDisplayName = (name: string) => {
    localStorage.setItem(DISPLAY_NAME_KEY, name);
    setDisplayNameState(name);
  };
  return [displayName, setDisplayName] as const;
}

function useRoom(transport: RoomTransport, roomId: string | undefined): RoomSnapshot | undefined {
  const [snapshot, setSnapshot] = useState(() => roomId === undefined ? undefined : transport.getSnapshot(roomId));
  useEffect(() => {
    if (roomId === undefined) return;
    return transport.subscribe(roomId, setSnapshot);
  }, [roomId, transport]);
  return snapshot;
}

function HomeScreen() {
  return (
    <>
      <section className="home-hero">
        <p className="eyebrow">Pick. Share. Play.</p>
        <h1>Game night,<br />right now.</h1>
        <p className="hero-copy">Ten familiar games, one easy link, and no account wall between you and your friends.</p>
        <div className="hero-actions">
          <AppLink className="button button-primary" to="/create">Create a room</AppLink>
          <AppLink className="button button-secondary" to="/join">Join a room</AppLink>
          <AppLink className="button button-quiet" to="/create?mode=solo">Play solo</AppLink>
        </div>
      </section>
      <section className="catalog-section" aria-labelledby="games-heading">
        <div className="section-heading"><p className="eyebrow">The game shelf</p><h2 id="games-heading">What are we playing?</h2></div>
        <div className="game-grid">
          {clientGames.map(({ metadata }) => <GameCard key={metadata.id} game={metadata} action={<AppLink className="card-link" to={`/create?game=${metadata.id}`}><span className="sr-only">Create a room for </span>Play {metadata.name}<span aria-hidden="true"> →</span></AppLink>} />)}
        </div>
      </section>
    </>
  );
}

function CreateScreen({ displayName, setDisplayName, transport }: {
  readonly displayName: string;
  readonly setDisplayName: (name: string) => void;
  readonly transport: RoomTransport;
}) {
  const route = useRoute();
  const solo = route.search.get("mode") === "solo";
  const requestedGame = route.search.get("game");
  const initialGame = getClientGame(requestedGame ?? "")?.metadata.id ?? (solo ? "tic-tac-toe-plus" : clientGames[0]?.metadata.id ?? "");
  const [gameId, setGameId] = useState(initialGame);
  const [name, setName] = useState(displayName);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function createRoom() {
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      setError("Use at least 2 characters for your display name.");
      return;
    }
    setError("");
    setPending(true);
    setDisplayName(cleanName);
    try {
      const room = await transport.createRoom({ displayName: cleanName, gameId, solo });
      if (solo) {
        await transport.setPhase(room.id, "playing");
        navigate(`/game/${room.id}?solo=1`);
      } else navigate(`/lobby/${room.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the room.");
      setPending(false);
    }
  }

  return (
    <section className="setup-layout">
      <div className="setup-intro"><p className="eyebrow">{solo ? "Solo table" : "New room"}</p><h1>{solo ? "Choose your challenge." : "Set the table."}</h1><p>{solo ? "Practice at your pace. Your score stays on this device." : "Pick a game now. As host, you can change it before starting."}</p></div>
      <div className="setup-controls">
        <label>Display name<input autoComplete="nickname" maxLength={24} value={name} onChange={(event) => { setName(event.target.value); }} placeholder="Your name" /></label>
        <GamePicker selectedId={gameId} onChange={setGameId} soloOnly={solo} />
        {error !== "" && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary" type="button" disabled={pending || gameId === ""} onClick={() => { void createRoom(); }}>{pending ? "Setting up…" : solo ? "Start solo game" : "Create room"}</button>
      </div>
    </section>
  );
}

function JoinScreen({ displayName, setDisplayName, transport, roomId }: {
  readonly displayName: string;
  readonly setDisplayName: (name: string) => void;
  readonly transport: RoomTransport;
  readonly roomId: string | undefined;
}) {
  return (
    <section className="centered-page">
      <p className="eyebrow">Your seat is waiting</p>
      <DisplayNameForm title={roomId === undefined ? "Join a room." : `Join ${roomId.toUpperCase()}.`} submitLabel="Join game" initialName={displayName} roomId={roomId} onSubmit={async (name, submittedRoomId) => {
        if (submittedRoomId === undefined) throw new Error("Enter a room code.");
        setDisplayName(name);
        const room = await transport.joinRoom({ roomId: submittedRoomId, displayName: name });
        navigate(`/lobby/${room.id}`);
      }} />
    </section>
  );
}

function MissingRoom({ roomId }: { readonly roomId: string }) {
  return <section className="message-state" role="status"><span aria-hidden="true">⌁</span><h1>Room not loaded</h1><p>Join with the room code to connect, or return home and create a new table.</p><div className="button-row"><AppLink className="button button-primary" to={`/join/${roomId}`}>Join {roomId}</AppLink><AppLink className="button button-secondary" to="/">Return home</AppLink></div></section>;
}

function LobbyScreen({ room, transport }: { readonly room: RoomSnapshot; readonly transport: RoomTransport }) {
  const isHost = room.localPlayerId === room.hostId;
  const [copyStatus, setCopyStatus] = useState("");
  const inviteUrl = `${window.location.origin}/join/${room.id}`;
  const metadata = getGameMetadata(room.gameId);

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyStatus("Invite link copied.");
    } catch {
      setCopyStatus("Copy unavailable. Select the link below.");
    }
  }

  return (
    <section className="room-layout">
      <div className="room-main">
        <div className="room-title"><div><p className="eyebrow">Room <span>{room.id}</span></p><h1>Gather your players.</h1></div><span className="player-count">{room.players.length}/{metadata?.maximumPlayers ?? 4} joined</span></div>
        <div className="invite-strip"><label>Share this invite<input readOnly value={inviteUrl} onFocus={(event) => { event.currentTarget.select(); }} /></label><button className="button button-secondary" type="button" onClick={() => { void copyInvite(); }}>Copy link</button></div>
        <p className="live-message" aria-live="polite">{copyStatus}</p>
        <section aria-labelledby="players-heading"><h2 id="players-heading">Players</h2><ul className="player-list">{room.players.map((player) => <li key={player.id}><span className={`avatar ${player.connected ? "" : "avatar-away"}`} aria-hidden="true">{player.displayName.slice(0, 1).toUpperCase()}</span><span><strong>{player.displayName}</strong><small>{player.id === room.hostId ? "Host" : player.connected ? "Ready" : "Reconnecting"}</small></span><span className={`presence ${player.connected ? "online" : "away"}`}>{player.connected ? "Online" : "Away"}</span></li>)}</ul></section>
      </div>
      <aside className="host-panel" aria-labelledby="room-settings"><p className="eyebrow">{isHost ? "Host controls" : "Room settings"}</p><h2 id="room-settings">{metadata?.name ?? "Choose a game"}</h2>{isHost ? <><GamePicker selectedId={room.gameId} onChange={(gameId) => { void transport.updateSettings(room.id, gameId, room.rounds); }} /><label>Rounds<select value={room.rounds} onChange={(event) => { void transport.updateSettings(room.id, room.gameId, Number(event.target.value)); }}><option value="1">1 round</option><option value="3">Best of 3</option><option value="5">Best of 5</option></select></label><button className="button button-primary button-full" type="button" onClick={() => { void transport.setPhase(room.id, "playing").then(() => { navigate(`/game/${room.id}`); }); }}>Start game</button></> : <p>The host will start when everyone is ready.</p>}</aside>
    </section>
  );
}

function GameScreen({ room, displayName, transport }: { readonly room: RoomSnapshot; readonly displayName: string; readonly transport: RoomTransport }) {
  const game = getClientGame(room.gameId);
  if (game === undefined) return <section className="message-state" role="alert"><h1>Game unavailable</h1><p>This game view could not be loaded. Ask the host to choose another.</p><AppLink className="button button-primary" to={`/lobby/${room.id}`}>Back to lobby</AppLink></section>;
  const GameView = game.View;
  const roomPlayerName = room.players.find((player) => player.id === room.localPlayerId)?.displayName ?? "Player";
  return <section className="game-layout"><header className="game-toolbar"><div><p className="eyebrow">Room {room.id}</p><h2>{game.metadata.name}</h2></div><p role="status"><span className="turn-dot" aria-hidden="true" />Live game</p></header><div className="game-content"><GameView gameId={room.gameId} roomId={room.id} playerName={displayName === "" ? roomPlayerName : displayName} state={room.gameState} sendCommand={(command) => transport.sendGameCommand(room.id, command)} onFinish={() => { void transport.setPhase(room.id, "results").then(() => { navigate(`/results/${room.id}`); }); }} /><Scoreboard players={room.players} /></div></section>;
}

function ResultsScreen({ room, transport }: { readonly room: RoomSnapshot; readonly transport: RoomTransport }) {
  const winner = [...room.players].sort((left, right) => right.score - left.score)[0];
  return <section className="results-layout"><div className="results-hero"><span className="result-mark" aria-hidden="true">★</span><p className="eyebrow">Game complete</p><h1>{winner === undefined ? "Good game." : `${winner.displayName} takes it!`}</h1><p>{winner === undefined ? "No scores were recorded this round." : `${String(winner.score)} points and a well-earned victory.`}</p><div className="button-row"><button className="button button-primary" type="button" onClick={() => { void transport.rematch(room.id).then(() => { navigate(`/game/${room.id}`); }); }}>Play again</button><AppLink className="button button-secondary" to="/">Return home</AppLink></div></div><Scoreboard heading="Final scores" players={room.players} /></section>;
}

export function App({ transport = defaultTransport }: { readonly transport?: RoomTransport }) {
  const route = useRoute();
  const [displayName, setDisplayName] = useDisplayName();
  const room = useRoom(transport, route.roomId);
  useEffect(() => {
    if (route.name === "game" && room?.phase === "results") navigate(`/results/${room.id}`);
  }, [room?.id, room?.phase, route.name]);
  function renderScreen() {
    if (route.name === "home") return <HomeScreen />;
    if (route.name === "create") return <CreateScreen displayName={displayName} setDisplayName={setDisplayName} transport={transport} />;
    if (route.name === "join") return <JoinScreen displayName={displayName} setDisplayName={setDisplayName} transport={transport} roomId={route.roomId} />;
    if (route.name === "not-found") return <section className="message-state"><span aria-hidden="true">404</span><h1>That page wandered off.</h1><p>Let&apos;s get you back to the games.</p><AppLink className="button button-primary" to="/">Return home</AppLink></section>;
    if (route.roomId === undefined || room === undefined) return <MissingRoom roomId={route.roomId ?? "ROOM"} />;
    if (route.name === "lobby") return <LobbyScreen room={room} transport={transport} />;
    if (route.name === "game") return <GameScreen room={room} displayName={displayName} transport={transport} />;
    return <ResultsScreen room={room} transport={transport} />;
  }

  return <PageShell roomStatus={room?.connection}>{renderScreen()}</PageShell>;
}

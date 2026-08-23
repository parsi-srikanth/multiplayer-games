import { gameRegistry } from "../games/registry";
import type { ClientMessage, RoomPhase, RoomProjection } from "../shared/protocol";

export const ROOM_CAPACITY = 4;
export const RECONNECT_GRACE_MS = 30 * 60 * 1000;
export const ROOM_INACTIVE_TTL_MS = 24 * 60 * 60 * 1000;
export const ROOM_STATE_SCHEMA_VERSION = 1;
export const MAX_ROOM_SNAPSHOT_BYTES = 128 * 1024;

export interface PlayerState {
  id: string;
  displayName: string;
  tokenHash: string;
  joinedAt: number;
  connected: boolean;
  disconnectedAt: number | null;
  gameScore: number;
  sessionScore: number;
}
export interface RoomState {
  schemaVersion: typeof ROOM_STATE_SCHEMA_VERSION;
  code: string;
  phase: RoomPhase;
  revision: number;
  hostId: string | null;
  selectedGameId: string | null;
  createdAt: number;
  updatedAt: number;
  players: PlayerState[];
  results: { playerId: string; score: number; rank: number }[] | null;
  /** Server-owned game state. It is never included directly in projectRoom(). */
  privateGameState: unknown;
}
export type EngineResult<T = undefined> =
  | { ok: true; value: T; changed: boolean }
  | { ok: false; code: "forbidden" | "invalid_transition" | "room_full" | "not_admitted" |
      "game_not_configured" | "internal_error"; message: string };

export function sanitizeDisplayName(input: string): string | undefined {
  const withoutControls = Array.from(input.normalize("NFKC"), (character) => {
    const code = character.codePointAt(0) ?? 0;
    return (code <= 31 || (code >= 127 && code <= 159)) ? " " : character;
  }).join("");
  const cleaned = withoutControls.replace(/\s+/g, " ").trim();
  if (cleaned.length === 0) return undefined;
  const graphemes = Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(cleaned), (part) => part.segment);
  return graphemes.slice(0, 24).join("");
}
export function createRoomState(code: string, now: number): RoomState {
  return { schemaVersion: ROOM_STATE_SCHEMA_VERSION, code, phase: "lobby", revision: 0, hostId: null,
    selectedGameId: null, createdAt: now, updatedAt: now, players: [], results: null, privateGameState: null };
}
export function roomExpiresAt(state: RoomState): number { return state.updatedAt + ROOM_INACTIVE_TTL_MS; }
export function isRoomExpired(state: RoomState, now: number): boolean { return now >= roomExpiresAt(state); }
function changed(state: RoomState, now: number): void { state.revision += 1; state.updatedAt = now; }
function player(state: RoomState, id: string): PlayerState | undefined { return state.players.find((item) => item.id === id); }
function electHost(state: RoomState): void {
  state.hostId = state.players.filter((item) => item.connected).sort((a, b) => a.joinedAt - b.joinedAt)[0]?.id ?? null;
}

export function admitPlayer(state: RoomState, input: { id: string; displayName: string; tokenHash: string; now: number }): EngineResult<PlayerState> {
  if (state.players.length >= ROOM_CAPACITY) return { ok: false, code: "room_full", message: "Room is full." };
  if (state.phase !== "lobby") return { ok: false, code: "invalid_transition", message: "New players may only join in the lobby." };
  const admitted: PlayerState = { id: input.id, displayName: input.displayName, tokenHash: input.tokenHash,
    joinedAt: input.now, connected: true, disconnectedAt: null, gameScore: 0, sessionScore: 0 };
  state.players.push(admitted);
  state.hostId ??= admitted.id;
  changed(state, input.now);
  return { ok: true, value: admitted, changed: true };
}
export function reconnectPlayer(state: RoomState, tokenHash: string, now: number): EngineResult<PlayerState> {
  const existing = state.players.find((item) => item.tokenHash === tokenHash);
  if (existing === undefined) return { ok: false, code: "not_admitted", message: "Reconnect token is invalid or expired." };
  const disconnectedAt = existing.disconnectedAt;
  if (disconnectedAt === null || now - disconnectedAt >= RECONNECT_GRACE_MS)
    return { ok: false, code: "not_admitted", message: "Reconnect token is invalid or expired." };
  existing.connected = true;
  existing.disconnectedAt = null;
  state.hostId ??= existing.id;
  changed(state, now);
  return { ok: true, value: existing, changed: true };
}
export function disconnectPlayer(state: RoomState, playerId: string, now: number): EngineResult {
  const existing = player(state, playerId);
  if (existing === undefined) return { ok: false, code: "not_admitted", message: "Player is not in this room." };
  if (!existing.connected) return { ok: true, value: undefined, changed: false };
  existing.connected = false;
  existing.disconnectedAt = now;
  if (state.hostId === playerId) electHost(state);
  changed(state, now);
  return { ok: true, value: undefined, changed: true };
}
function removePlayer(state: RoomState, playerId: string, now: number): boolean {
  const index = state.players.findIndex((item) => item.id === playerId);
  if (index < 0) return false;
  state.players.splice(index, 1);
  if (state.hostId === playerId || state.hostId === null) electHost(state);
  if (state.players.length === 0) {
    state.phase = "lobby"; state.selectedGameId = null; state.results = null; state.privateGameState = null;
  }
  changed(state, now);
  return true;
}
export function leavePlayer(state: RoomState, playerId: string, now: number): EngineResult {
  return removePlayer(state, playerId, now)
    ? { ok: true, value: undefined, changed: true }
    : { ok: false, code: "not_admitted", message: "Player is not in this room." };
}
export function expireDisconnectedPlayers(state: RoomState, now: number): string[] {
  const expired = state.players.filter((item) => !item.connected && item.disconnectedAt !== null &&
    now - item.disconnectedAt >= RECONNECT_GRACE_MS).map((item) => item.id);
  for (const id of expired) removePlayer(state, id, now);
  return expired;
}
function requireHost(state: RoomState, actorId: string): EngineResult | undefined {
  return state.hostId === actorId ? undefined : { ok: false, code: "forbidden", message: "Only the host may do that." };
}
function rankings(state: RoomState): { playerId: string; score: number; rank: number }[] {
  const sorted = state.players.map((item) => ({ playerId: item.id, score: item.gameScore }))
    .sort((a, b) => b.score - a.score || a.playerId.localeCompare(b.playerId));
  let rank = 0; let prior: number | undefined;
  return sorted.map((item, index) => { if (item.score !== prior) rank = index + 1; prior = item.score; return { ...item, rank }; });
}
function startSelectedGame(state: RoomState, now: number): EngineResult {
  if (state.selectedGameId === null) return { ok: false, code: "game_not_configured", message: "Select an available game first." };
  const game = gameRegistry.get(state.selectedGameId);
  if (game === undefined) return { ok: false, code: "game_not_configured", message: "That game is not available." };
  const connected = state.players.filter((item) => item.connected);
  if (connected.length !== state.players.length || connected.length < game.metadata.minimumPlayers || connected.length > game.metadata.maximumPlayers)
    return { ok: false, code: "invalid_transition", message: `This game requires ${String(game.metadata.minimumPlayers)}–${String(game.metadata.maximumPlayers)} connected players.` };
  let gameState: unknown;
  try { gameState = game.createInitialState(connected.map((item) => ({ id: item.id, displayName: item.displayName })), state.code, now); }
  catch { return { ok: false, code: "internal_error", message: "The game could not start safely." }; }
  for (const item of state.players) item.gameScore = 0;
  state.results = null;
  state.phase = "playing";
  state.privateGameState = gameState;
  changed(state, now);
  return { ok: true, value: undefined, changed: true };
}
function applyGameCommand(state: RoomState, actorId: string, command: unknown, now: number): EngineResult {
  if (state.phase !== "playing" || state.selectedGameId === null || state.privateGameState === null)
    return { ok: false, code: "invalid_transition", message: "No game is currently accepting commands." };
  const game = gameRegistry.get(state.selectedGameId);
  if (game === undefined) return { ok: false, code: "game_not_configured", message: "That game is not available." };
  const transition = game.applyCommand(state.privateGameState, command, actorId, state.code, now);
  if (!transition.accepted) return { ok: false, code: "invalid_transition", message: transition.reason };
  state.privateGameState = transition.state;
  if (game.isComplete(transition.state)) {
    const scores = game.scores(transition.state);
    for (const item of state.players) {
      const score = scores[item.id] ?? 0;
      if (!Number.isSafeInteger(score) || score < 0 || score > 1_000_000)
        return { ok: false, code: "internal_error", message: "The game produced an invalid score." };
      item.gameScore = score;
      item.sessionScore = Math.min(Number.MAX_SAFE_INTEGER, item.sessionScore + score);
    }
    state.results = rankings(state);
    state.phase = "results";
  }
  changed(state, now);
  return { ok: true, value: undefined, changed: true };
}

export function applyRoomMessage(state: RoomState, actorId: string, message: ClientMessage, now: number): EngineResult {
  if (player(state, actorId) === undefined) return { ok: false, code: "not_admitted", message: "Player is not in this room." };
  const hostError = requireHost(state, actorId);
  switch (message.type) {
    case "room:select_game":
      if (hostError) return hostError;
      if (state.phase !== "lobby") return { ok: false, code: "invalid_transition", message: "A game can only be selected in the lobby." };
      if (gameRegistry.get(message.gameId) === undefined) return { ok: false, code: "game_not_configured", message: "That game is not available." };
      state.selectedGameId = message.gameId; changed(state, now); break;
    case "room:start":
      if (hostError) return hostError;
      if (state.phase !== "lobby") return { ok: false, code: "invalid_transition", message: "A game can only start from the lobby." };
      return startSelectedGame(state, now);
    case "game:command": return applyGameCommand(state, actorId, message.command, now);
    case "room:return_lobby":
      if (hostError) return hostError;
      if (state.phase !== "results") return { ok: false, code: "invalid_transition", message: "Return is only available from results." };
      state.phase = "lobby"; state.results = null; state.privateGameState = null;
      for (const item of state.players) item.gameScore = 0;
      changed(state, now); break;
    case "room:rematch":
      if (hostError) return hostError;
      if (state.phase !== "results") return { ok: false, code: "invalid_transition", message: "Rematch is only available from results." };
      return startSelectedGame(state, now);
    case "room:leave": return leavePlayer(state, actorId, now);
    case "client:hello": case "client:ping": return { ok: true, value: undefined, changed: false };
  }
  return { ok: true, value: undefined, changed: true };
}
export function gameProjectionFor(state: RoomState, viewerId: string): unknown {
  if (state.selectedGameId === null || state.privateGameState === null) return null;
  const game = gameRegistry.get(state.selectedGameId);
  if (game === undefined) return null;
  try { return game.projectState(state.privateGameState, viewerId); } catch { return null; }
}
export function projectRoom(state: RoomState, viewerId: string, gameProjection: unknown = null): RoomProjection {
  return { code: state.code, phase: state.phase, revision: state.revision, selectedGameId: state.selectedGameId,
    players: state.players.map((item) => ({ id: item.id, displayName: item.displayName,
      presence: item.connected ? "connected" : "reconnecting", isHost: item.id === state.hostId,
      gameScore: item.gameScore, sessionScore: item.sessionScore })),
    results: state.results, viewer: { playerId: viewerId, isHost: viewerId === state.hostId }, game: gameProjection };
}

import type { ClientMessage, RoomPhase, RoomProjection } from "../shared/protocol";

export const ROOM_CAPACITY = 4;
export const RECONNECT_GRACE_MS = 30_000;

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
  code: string;
  phase: RoomPhase;
  revision: number;
  hostId: string | null;
  selectedGameId: string | null;
  createdAt: number;
  updatedAt: number;
  players: PlayerState[];
  results: { playerId: string; score: number; rank: number }[] | null;
  /** Server-owned game state. It is never included by projectRoom(). */
  privateGameState: unknown;
}
export type EngineResult<T = undefined> =
  | { ok: true; value: T; changed: boolean }
  | { ok: false; code: "forbidden" | "invalid_transition" | "room_full" | "not_admitted"; message: string };

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
  return { code, phase: "lobby", revision: 0, hostId: null, selectedGameId: null, createdAt: now,
    updatedAt: now, players: [], results: null, privateGameState: null };
}
function changed(state: RoomState, now: number): void { state.revision += 1; state.updatedAt = now; }
function player(state: RoomState, id: string): PlayerState | undefined { return state.players.find((item) => item.id === id); }

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
  existing.connected = true;
  existing.disconnectedAt = null;
  changed(state, now);
  return { ok: true, value: existing, changed: true };
}
export function disconnectPlayer(state: RoomState, playerId: string, now: number): EngineResult {
  const existing = player(state, playerId);
  if (existing === undefined) return { ok: false, code: "not_admitted", message: "Player is not in this room." };
  if (!existing.connected) return { ok: true, value: undefined, changed: false };
  existing.connected = false;
  existing.disconnectedAt = now;
  changed(state, now);
  return { ok: true, value: undefined, changed: true };
}
function removePlayer(state: RoomState, playerId: string, now: number): boolean {
  const index = state.players.findIndex((item) => item.id === playerId);
  if (index < 0) return false;
  state.players.splice(index, 1);
  if (state.hostId === playerId) state.hostId = state.players.slice().sort((a, b) => a.joinedAt - b.joinedAt)[0]?.id ?? null;
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
  const expired = state.players.filter((item) => !item.connected && item.disconnectedAt !== null && now - item.disconnectedAt >= RECONNECT_GRACE_MS).map((item) => item.id);
  for (const id of expired) removePlayer(state, id, now);
  return expired;
}
function requireHost(state: RoomState, actorId: string): EngineResult | undefined {
  return state.hostId === actorId ? undefined : { ok: false, code: "forbidden", message: "Only the host may do that." };
}
function rankings(state: RoomState): { playerId: string; score: number; rank: number }[] {
  const sorted = state.players.map((item) => ({ playerId: item.id, score: item.gameScore })).sort((a, b) => b.score - a.score || a.playerId.localeCompare(b.playerId));
  let rank = 0; let prior: number | undefined;
  return sorted.map((item, index) => { if (item.score !== prior) rank = index + 1; prior = item.score; return { ...item, rank }; });
}
export function applyRoomMessage(state: RoomState, actorId: string, message: ClientMessage, now: number): EngineResult {
  const actor = player(state, actorId);
  if (actor === undefined) return { ok: false, code: "not_admitted", message: "Player is not in this room." };
  const hostError = requireHost(state, actorId);
  switch (message.type) {
    case "room:select_game":
      if (hostError) return hostError;
      if (state.phase !== "lobby") return { ok: false, code: "invalid_transition", message: "A game can only be selected in the lobby." };
      state.selectedGameId = message.gameId; changed(state, now); break;
    case "room:start":
      if (hostError) return hostError;
      if (state.phase !== "lobby" || state.selectedGameId === null || state.players.filter((item) => item.connected).length < 1)
        return { ok: false, code: "invalid_transition", message: "Select a game with at least one connected player first." };
      for (const item of state.players) item.gameScore = 0;
      state.results = null; state.phase = "starting"; changed(state, now); break;
    case "game:score": {
      if (hostError) return hostError;
      if (state.phase !== "playing") return { ok: false, code: "invalid_transition", message: "Scores may only change while playing." };
      const target = player(state, message.playerId);
      if (target === undefined) return { ok: false, code: "not_admitted", message: "Score target is not in this room." };
      const next = target.gameScore + message.delta;
      if (!Number.isSafeInteger(next) || Math.abs(next) > 1_000_000) return { ok: false, code: "invalid_transition", message: "Score is outside the allowed range." };
      target.gameScore = next; changed(state, now); break;
    }
    case "game:finish":
      if (hostError) return hostError;
      if (state.phase !== "playing") return { ok: false, code: "invalid_transition", message: "Only a running game can finish." };
      for (const item of state.players) item.sessionScore += item.gameScore;
      state.results = rankings(state); state.phase = "results"; state.privateGameState = null; changed(state, now); break;
    case "room:return_lobby":
      if (hostError) return hostError;
      if (state.phase !== "results") return { ok: false, code: "invalid_transition", message: "Return is only available from results." };
      state.phase = "lobby"; state.results = null; for (const item of state.players) item.gameScore = 0; changed(state, now); break;
    case "room:rematch":
      if (hostError) return hostError;
      if (state.phase !== "results" || state.selectedGameId === null) return { ok: false, code: "invalid_transition", message: "Rematch is only available from results." };
      state.phase = "starting"; state.results = null; for (const item of state.players) item.gameScore = 0; changed(state, now); break;
    case "room:leave": return leavePlayer(state, actorId, now);
    case "game:command": return { ok: false, code: "invalid_transition", message: "The selected game does not handle commands yet." };
    case "client:hello": case "client:ping": return { ok: true, value: undefined, changed: false };
  }
  return { ok: true, value: undefined, changed: true };
}
export function advanceStarting(state: RoomState, now: number): boolean {
  if (state.phase !== "starting") return false;
  state.phase = "playing"; changed(state, now); return true;
}
export function projectRoom(state: RoomState, viewerId: string, gameProjection: unknown = null): RoomProjection {
  return { code: state.code, phase: state.phase, revision: state.revision, selectedGameId: state.selectedGameId,
    players: state.players.map((item) => ({ id: item.id, displayName: item.displayName,
      presence: item.connected ? "connected" : "reconnecting", isHost: item.id === state.hostId,
      gameScore: item.gameScore, sessionScore: item.sessionScore })),
    results: state.results, viewer: { playerId: viewerId, isHost: viewerId === state.hostId }, game: gameProjection };
}

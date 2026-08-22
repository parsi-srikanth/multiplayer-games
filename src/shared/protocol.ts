import { PROTOCOL_VERSION } from "./game-contract";
import type { GameId, PlayerId, RoomId } from "./game-contract";

/** Small enough for room commands while preventing the platform's 32 MiB frame limit from becoming ours. */
export const MAX_MESSAGE_BYTES = 16 * 1024;
export const MAX_CLIENT_MESSAGE_BYTES = MAX_MESSAGE_BYTES;

const textEncoder = new TextEncoder();

export function isClientMessageWithinLimit(value: string): boolean {
  // Every UTF-16 code unit produces at least one UTF-8 byte. This fast path avoids
  // allocating another large buffer for an obviously oversized hostile frame.
  return value.length <= MAX_MESSAGE_BYTES && textEncoder.encode(value).byteLength <= MAX_MESSAGE_BYTES;
}
export const MAX_DISPLAY_NAME_LENGTH = 24;
export const MAX_GAME_ID_LENGTH = 32;
export const MAX_RECONNECT_TOKEN_LENGTH = 128;
export const MAX_SCORE_DELTA = 10_000;

export type RoomPhase = "lobby" | "starting" | "playing" | "results";
export type Presence = "connected" | "reconnecting";

export interface ClientHelloMessage {
  readonly type: "client:hello";
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly displayName: string;
  readonly reconnectToken?: string;
}
export interface ClientPingMessage { readonly type: "client:ping"; readonly nonce: string }
export interface SelectGameMessage { readonly type: "room:select_game"; readonly gameId: GameId }
export interface StartGameMessage { readonly type: "room:start" }
export interface RecordScoreMessage {
  readonly type: "game:score";
  readonly playerId: PlayerId;
  readonly delta: number;
}
export interface FinishGameMessage { readonly type: "game:finish" }
export interface ReturnLobbyMessage { readonly type: "room:return_lobby" }
export interface RematchMessage { readonly type: "room:rematch" }
export interface LeaveMessage { readonly type: "room:leave" }
export interface GameCommandMessage { readonly type: "game:command"; readonly command: unknown }

export type ClientMessage = ClientHelloMessage | ClientPingMessage | SelectGameMessage |
  StartGameMessage | RecordScoreMessage | FinishGameMessage | ReturnLobbyMessage |
  RematchMessage | LeaveMessage | GameCommandMessage;

export interface PlayerProjection {
  readonly id: PlayerId;
  readonly displayName: string;
  readonly presence: Presence;
  readonly isHost: boolean;
  readonly gameScore: number;
  readonly sessionScore: number;
}
export interface RoomProjection {
  readonly code: RoomId;
  readonly phase: RoomPhase;
  readonly revision: number;
  readonly selectedGameId: GameId | null;
  readonly players: readonly PlayerProjection[];
  readonly results: readonly { playerId: PlayerId; score: number; rank: number }[] | null;
  readonly viewer: { readonly playerId: PlayerId; readonly isHost: boolean };
  /** Only a game module's explicit viewer projection may be placed here. */
  readonly game: unknown;
}
export interface ServerHelloMessage {
  readonly type: "server:hello";
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly roomId: RoomId;
  readonly playerId: PlayerId;
  readonly reconnectToken: string;
  readonly reconnectGraceMs: number;
}
export interface ServerPongMessage { readonly type: "server:pong"; readonly nonce: string }
export interface RoomStateMessage { readonly type: "room:state"; readonly room: RoomProjection }
export interface GameStateMessage {
  readonly type: "game:state";
  readonly gameId: GameId;
  readonly revision: number;
  readonly state: unknown;
}
export interface ServerErrorMessage {
  readonly type: "server:error";
  readonly code: "invalid_message" | "not_admitted" | "forbidden" | "invalid_transition" |
    "room_full" | "rate_limited" | "game_not_configured" | "internal_error";
  readonly message: string;
}
export type ServerMessage = ServerHelloMessage | ServerPongMessage | RoomStateMessage |
  GameStateMessage | ServerErrorMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function exactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => key in value) && Object.keys(value).every((key) => allowed.has(key));
}
function boundedString(value: unknown, min: number, max: number): value is string {
  return typeof value === "string" && value.length >= min && value.length <= max;
}
function isJsonValue(value: unknown, depth = 0): boolean {
  if (depth > 8) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 128 && value.every((item) => isJsonValue(item, depth + 1));
  return isRecord(value) && Object.keys(value).length <= 128 && Object.values(value).every((item) => isJsonValue(item, depth + 1));
}

export function parseClientMessage(value: string): ClientMessage | undefined {
  if (!isClientMessageWithinLimit(value)) return undefined;
  let parsed: unknown;
  try { parsed = JSON.parse(value) as unknown; } catch { return undefined; }
  if (!isRecord(parsed) || typeof parsed.type !== "string") return undefined;
  switch (parsed.type) {
    case "client:hello": {
      if (!exactKeys(parsed, ["type", "protocolVersion", "displayName"], ["reconnectToken"]) ||
          parsed.protocolVersion !== PROTOCOL_VERSION || !boundedString(parsed.displayName, 1, 80) ||
          (parsed.reconnectToken !== undefined && !boundedString(parsed.reconnectToken, 32, MAX_RECONNECT_TOKEN_LENGTH))) return undefined;
      return { type: parsed.type, protocolVersion: PROTOCOL_VERSION, displayName: parsed.displayName,
        ...(parsed.reconnectToken === undefined ? {} : { reconnectToken: parsed.reconnectToken }) };
    }
    case "client:ping":
      return exactKeys(parsed, ["type", "nonce"]) && boundedString(parsed.nonce, 0, 128) ? { type: parsed.type, nonce: parsed.nonce } : undefined;
    case "room:select_game":
      return exactKeys(parsed, ["type", "gameId"]) && boundedString(parsed.gameId, 1, MAX_GAME_ID_LENGTH) && /^[a-z0-9-]+$/.test(parsed.gameId) ? { type: parsed.type, gameId: parsed.gameId } : undefined;
    case "game:score":
      return exactKeys(parsed, ["type", "playerId", "delta"]) && boundedString(parsed.playerId, 1, 64) &&
        typeof parsed.delta === "number" && Number.isSafeInteger(parsed.delta) && Math.abs(parsed.delta) <= MAX_SCORE_DELTA
        ? { type: parsed.type, playerId: parsed.playerId, delta: parsed.delta } : undefined;
    case "game:command":
      return exactKeys(parsed, ["type", "command"]) && isJsonValue(parsed.command) ? { type: parsed.type, command: parsed.command } : undefined;
    case "room:start": case "game:finish": case "room:return_lobby": case "room:rematch": case "room:leave":
      return exactKeys(parsed, ["type"]) ? { type: parsed.type } : undefined;
    default: return undefined;
  }
}

export function serializeServerMessage(message: ServerMessage): string { return JSON.stringify(message); }

import { PROTOCOL_VERSION } from "./game-contract";
import type { GameId, PlayerId, RoomId } from "./game-contract";

/** Small enough for room commands while preventing the platform's 32 MiB frame limit from becoming ours. */
export const MAX_CLIENT_MESSAGE_BYTES = 16 * 1024;

const textEncoder = new TextEncoder();

export function isClientMessageWithinLimit(value: string): boolean {
  // Every UTF-16 code unit produces at least one UTF-8 byte. This fast path avoids
  // allocating another large buffer for an obviously oversized hostile frame.
  return value.length <= MAX_CLIENT_MESSAGE_BYTES &&
    textEncoder.encode(value).byteLength <= MAX_CLIENT_MESSAGE_BYTES;
}

export interface ClientHelloMessage {
  readonly type: "client:hello";
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly displayName: string;
}

export interface ClientPingMessage {
  readonly type: "client:ping";
  readonly nonce: string;
}

export interface GameCommandMessage {
  readonly type: "game:command";
  readonly command: unknown;
}

export type ClientMessage = ClientHelloMessage | ClientPingMessage | GameCommandMessage;

export interface ServerHelloMessage {
  readonly type: "server:hello";
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly roomId: RoomId;
  readonly playerId: PlayerId;
}

export interface ServerPongMessage {
  readonly type: "server:pong";
  readonly nonce: string;
}

export interface GameStateMessage {
  readonly type: "game:state";
  readonly gameId: GameId;
  readonly revision: number;
  readonly state: unknown;
}

export interface ServerErrorMessage {
  readonly type: "server:error";
  readonly code: "invalid_message" | "game_not_configured" | "internal_error";
  readonly message: string;
}

export type ServerMessage =
  | ServerHelloMessage
  | ServerPongMessage
  | GameStateMessage
  | ServerErrorMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseClientMessage(value: string): ClientMessage | undefined {
  if (!isClientMessageWithinLimit(value)) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }

  if (!isRecord(parsed) || typeof parsed.type !== "string") return undefined;

  switch (parsed.type) {
    case "client:hello":
      return parsed.protocolVersion === PROTOCOL_VERSION &&
        typeof parsed.displayName === "string" &&
        parsed.displayName.trim().length > 0 &&
        parsed.displayName.length <= 40
        ? { type: parsed.type, protocolVersion: PROTOCOL_VERSION, displayName: parsed.displayName.trim() }
        : undefined;
    case "client:ping":
      return typeof parsed.nonce === "string" && parsed.nonce.length <= 128
        ? { type: parsed.type, nonce: parsed.nonce }
        : undefined;
    case "game:command":
      return "command" in parsed ? { type: parsed.type, command: parsed.command } : undefined;
    default:
      return undefined;
  }
}

export function serializeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message);
}

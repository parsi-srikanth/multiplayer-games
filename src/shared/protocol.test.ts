import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION } from "./game-contract";
import {
  isClientMessageWithinLimit,
  MAX_CLIENT_MESSAGE_BYTES,
  MAX_MESSAGE_BYTES,
  parseClientMessage,
  serializeServerMessage,
} from "./protocol";

const validMessages = [
  { type: "client:hello", protocolVersion: PROTOCOL_VERSION, displayName: " Ada " },
  { type: "client:hello", protocolVersion: PROTOCOL_VERSION, displayName: "Ada", reconnectToken: "x".repeat(32) },
  { type: "client:ping", nonce: "abc" }, { type: "room:select_game", gameId: "word-race" },
  { type: "room:start" },
  { type: "room:return_lobby" }, { type: "room:rematch" }, { type: "room:leave" },
  { type: "game:command", command: { move: 1 } },
] as const;

describe("versioned multiplayer protocol", () => {
  it.each(validMessages)("accepts $type", (message) => { expect(parseClientMessage(JSON.stringify(message))).toEqual(message); });
  it.each(["not-json", "null",
    JSON.stringify({ type: "client:hello", protocolVersion: 999, displayName: "Ada" }),
    JSON.stringify({ type: "client:hello", protocolVersion: PROTOCOL_VERSION, displayName: "", extra: true }),
    JSON.stringify({ type: "client:ping", nonce: 12 }), JSON.stringify({ type: "room:select_game", gameId: "UPPER" }),
    JSON.stringify({ type: "game:score", playerId: "p1", delta: 5 }), JSON.stringify({ type: "game:finish" }),
    '{"type":"game:command","command":{"value":1e999}}', JSON.stringify({ type: "unknown" }),
  ])("rejects invalid and unbounded message %s", (message) => { expect(parseClientMessage(message)).toBeUndefined(); });
  it("rejects payloads over the byte limit", () => {
    expect(parseClientMessage(JSON.stringify({ type: "game:command", command: "x".repeat(MAX_MESSAGE_BYTES) }))).toBeUndefined();
  });
  it("serializes server messages", () => {
    expect(serializeServerMessage({ type: "server:pong", nonce: "abc" })).toBe('{"type":"server:pong","nonce":"abc"}');
  });

  it("rejects oversized envelopes before parsing", () => {
    const oversized = JSON.stringify({
      type: "game:command",
      command: { nested: { ignored: "x".repeat(MAX_CLIENT_MESSAGE_BYTES) } },
    });

    expect(isClientMessageWithinLimit(oversized)).toBe(false);
    expect(parseClientMessage(oversized)).toBeUndefined();
  });

  it("measures the UTF-8 byte size, not only JavaScript string length", () => {
    const multibyte = "😀".repeat(MAX_CLIENT_MESSAGE_BYTES / 2);

    expect(multibyte.length).toBe(MAX_CLIENT_MESSAGE_BYTES);
    expect(isClientMessageWithinLimit(multibyte)).toBe(false);
    expect(parseClientMessage(multibyte)).toBeUndefined();
  });
});

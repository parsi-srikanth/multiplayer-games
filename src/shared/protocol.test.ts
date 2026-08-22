import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION } from "./game-contract";
import {
  isClientMessageWithinLimit,
  MAX_CLIENT_MESSAGE_BYTES,
  parseClientMessage,
  serializeServerMessage,
} from "./protocol";

const validMessages = [
  [{ type: "client:hello", protocolVersion: PROTOCOL_VERSION, displayName: " Ada " }, "client:hello"],
  [{ type: "client:ping", nonce: "abc" }, "client:ping"],
  [{ type: "game:command", command: { move: 1 } }, "game:command"],
] as const;

describe("multiplayer protocol", () => {
  it.each(validMessages)("accepts %s", (message, type) => {
    expect(parseClientMessage(JSON.stringify(message))?.type).toBe(type);
  });

  it.each([
    "not-json",
    "null",
    JSON.stringify({ type: "client:hello", protocolVersion: 999, displayName: "Ada" }),
    JSON.stringify({ type: "client:hello", protocolVersion: PROTOCOL_VERSION, displayName: "" }),
    JSON.stringify({ type: "client:ping", nonce: 12 }),
    JSON.stringify({ type: "unknown" }),
  ])("rejects invalid message %s", (message) => {
    expect(parseClientMessage(message)).toBeUndefined();
  });

  it("serializes a server message", () => {
    expect(
      serializeServerMessage({ type: "server:pong", nonce: "abc" }),
    ).toBe('{"type":"server:pong","nonce":"abc"}');
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

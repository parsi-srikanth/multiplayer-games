import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION } from "./game-contract";
import { parseClientMessage, serializeServerMessage } from "./protocol";

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
});

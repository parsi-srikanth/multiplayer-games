// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CloudflareRoomTransport } from "./cloudflare-transport";

class FakeWebSocket {
  static readonly OPEN = 1;
  static readonly instances: FakeWebSocket[] = [];
  readyState = 0;
  readonly sent: string[] = [];
  readonly #listeners = new Map<string, ((event: MessageEvent | CloseEvent | Event) => void)[]>();
  constructor(readonly url: string) { FakeWebSocket.instances.push(this); }
  addEventListener(type: string, listener: (event: MessageEvent | CloseEvent | Event) => void): void {
    const listeners = this.#listeners.get(type) ?? []; listeners.push(listener); this.#listeners.set(type, listeners);
  }
  send(value: string): void { this.sent.push(value); }
  close(code = 1000, reason = ""): void { this.readyState = 3; this.#dispatch("close", new CloseEvent("close", { code, reason })); }
  open(): void { this.readyState = FakeWebSocket.OPEN; this.#dispatch("open", new Event("open")); }
  server(message: unknown): void { this.#dispatch("message", new MessageEvent("message", { data: JSON.stringify(message) })); }
  #dispatch(type: string, event: MessageEvent | CloseEvent | Event): void { this.#listeners.get(type)?.forEach((listener) => { listener(event); }); }
}

function roomState(revision: number, gameId: string | null = null) {
  return { type: "room:state", room: { code: "ABCDE", phase: "lobby", revision, selectedGameId: gameId,
    players: [{ id: "p1", displayName: "Ada", presence: "connected", isHost: true, gameScore: 0, sessionScore: 0 }],
    results: null, viewer: { playerId: "p1", isHost: true }, game: null } };
}

async function admit(transport: CloudflareRoomTransport) {
  const promise = transport.joinRoom({ roomId: "ABCDE", displayName: "Ada" });
  const socket = FakeWebSocket.instances.at(-1);
  if (socket === undefined) throw new Error("Expected a socket");
  socket.open();
  expect(JSON.parse(socket.sent[0] ?? "{}")).toMatchObject({ type: "client:hello", displayName: "Ada" });
  socket.server({ type: "server:hello", protocolVersion: 1, roomId: "ABCDE", playerId: "p1", reconnectToken: "x".repeat(43), reconnectGraceMs: 1_800_000 });
  socket.server(roomState(1));
  return { socket, snapshot: await promise };
}

beforeEach(() => {
  FakeWebSocket.instances.length = 0;
  vi.stubGlobal("WebSocket", FakeWebSocket);
  localStorage.clear();
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("CloudflareRoomTransport", () => {
  it("adopts a server projection, stores the reconnect credential, and confirms commands by revision", async () => {
    const transport = new CloudflareRoomTransport();
    const { socket, snapshot } = await admit(transport);
    expect(snapshot).toMatchObject({ id: "ABCDE", hostId: "p1", localPlayerId: "p1", connection: "connected", revision: 1 });
    expect(localStorage.getItem("parsi-games-reconnect:ABCDE")).toBe("x".repeat(43));

    const update = transport.updateSettings("ABCDE", "word-race");
    expect(JSON.parse(socket.sent.at(-1) ?? "{}")).toEqual({ type: "room:select_game", gameId: "word-race" });
    socket.server(roomState(2, "word-race"));
    await expect(update).resolves.toBeUndefined();
    expect(transport.getSnapshot("ABCDE")?.gameId).toBe("word-race");
  });

  it("creates through HTTP before opening the room WebSocket", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "ABCDE" }), { status: 201, headers: { "Content-Type": "application/json" } })));
    const transport = new CloudflareRoomTransport();
    const created = transport.createRoom({ displayName: "Ada", gameId: "word-race" });
    await vi.waitFor(() => { expect(FakeWebSocket.instances).toHaveLength(1); });
    const socket = FakeWebSocket.instances[0];
    if (socket === undefined) throw new Error("Expected a socket");
    socket.open();
    socket.server({ type: "server:hello", protocolVersion: 1, roomId: "ABCDE", playerId: "p1", reconnectToken: "y".repeat(43), reconnectGraceMs: 1_800_000 });
    socket.server(roomState(1));
    await vi.waitFor(() => { expect(JSON.parse(socket.sent.at(-1) ?? "{}")).toMatchObject({ type: "room:select_game" }); });
    socket.server(roomState(2, "word-race"));
    await expect(created).resolves.toMatchObject({ gameId: "word-race", revision: 2 });
  });
});

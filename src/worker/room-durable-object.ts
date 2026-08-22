import { DurableObject } from "cloudflare:workers";
import { PROTOCOL_VERSION } from "../shared/game-contract";
import {
  isClientMessageWithinLimit,
  parseClientMessage,
  serializeServerMessage,
} from "../shared/protocol";
import type { ServerErrorMessage } from "../shared/protocol";

interface SessionAttachment {
  readonly playerId: string;
  readonly roomId: string;
  readonly connectedAt: number;
}

function errorMessage(code: ServerErrorMessage["code"], message: string): string {
  return serializeServerMessage({ type: "server:error", code, message });
}

export class RoomDurableObject extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS room_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      ) STRICT;
    `);
  }

  override fetch(request: Request): Response {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return Response.json({ error: "WebSocket upgrade required" }, { status: 426 });
    }

    const roomId = request.headers.get("X-Room-ID");
    if (roomId === null) {
      return Response.json({ error: "Room context missing" }, { status: 400 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const attachment: SessionAttachment = {
      playerId: crypto.randomUUID(),
      roomId,
      connectedAt: Date.now(),
    };

    server.serializeAttachment(attachment);
    this.ctx.acceptWebSocket(server);
    server.send(
      serializeServerMessage({
        type: "server:hello",
        protocolVersion: PROTOCOL_VERSION,
        roomId,
        playerId: attachment.playerId,
      }),
    );

    return new Response(null, { status: 101, webSocket: client });
  }

  override webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== "string") {
      webSocket.send(errorMessage("invalid_message", "Binary messages are not supported."));
      webSocket.close(1003, "Binary messages are not supported");
      return;
    }

    if (!isClientMessageWithinLimit(message)) {
      webSocket.close(1009, "Message exceeds the application limit");
      return;
    }

    const parsed = parseClientMessage(message);
    if (parsed === undefined) {
      webSocket.send(errorMessage("invalid_message", "Message does not match protocol v1."));
      return;
    }

    if (parsed.type === "client:ping") {
      webSocket.send(serializeServerMessage({ type: "server:pong", nonce: parsed.nonce }));
      return;
    }

    if (parsed.type === "game:command") {
      webSocket.send(
        errorMessage("game_not_configured", "This room does not have a game module yet."),
      );
    }
  }

  override webSocketClose(webSocket: WebSocket, code: number): void {
    const validCode = code === 1000 ||
      (code >= 1001 && code <= 1014 && ![1004, 1005, 1006].includes(code)) ||
      (code >= 3000 && code <= 4999);
    webSocket.close(validCode ? code : 1000, "Connection closed");
  }

  override webSocketError(webSocket: WebSocket): void {
    webSocket.close(1011, "WebSocket error");
  }
}

import { RoomDurableObject } from "./room-durable-object";
import { isWebSocketUpgrade, roomIdFromPath } from "./routing";

export { RoomDurableObject };

function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health" && request.method === "GET") {
      return Response.json({ status: "ok" });
    }

    const roomId = roomIdFromPath(url.pathname);
    if (roomId !== undefined) {
      if (!isWebSocketUpgrade(request)) {
        return jsonError(426, "Expected a GET WebSocket upgrade.");
      }

      const headers = new Headers(request.headers);
      headers.set("X-Room-ID", roomId);
      const roomRequest = new Request(request, { headers });
      return env.ROOMS.getByName(roomId).fetch(roomRequest);
    }

    if (url.pathname.startsWith("/api/")) {
      return jsonError(404, "API route not found.");
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

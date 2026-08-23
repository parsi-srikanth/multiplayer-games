import { RoomDurableObject } from "./room-durable-object";
import { generateRoomCode, isAllowedOrigin, isWebSocketUpgrade, roomIdFromPath, roomInfoIdFromPath } from "./routing";

export { RoomDurableObject };
function corsHeaders(origin: string | null): Record<string, string> {
  return origin === null ? {} : { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
}
function jsonError(status: number, message: string, origin: string | null): Response {
  return Response.json({ error: message }, { status, headers: corsHeaders(origin) });
}
function multiplayerUnavailable(origin: string | null): Response {
  return Response.json(
    { error: "Multiplayer is temporarily unavailable. Solo games remain available.", code: "multiplayer_unavailable" },
    { status: 503, headers: { ...corsHeaders(origin), "Retry-After": "300" } },
  );
}
async function enforceRateLimit(binding: RateLimit, request: Request, origin: string | null): Promise<Response | undefined> {
  try {
    const result = await binding.limit({ key: request.headers.get("CF-Connecting-IP") ?? "unknown-client" });
    if (result.success) return undefined;
    return Response.json(
      { error: "This multiplayer action is temporarily limited. Solo play remains available.", code: "multiplayer_rate_limited" },
      { status: 429, headers: { ...corsHeaders(origin), "Retry-After": "60" } },
    );
  } catch { return multiplayerUnavailable(origin); }
}
function withCors(response: Response, origin: string | null): Response {
  const next = new Response(response.body, response);
  for (const [key, value] of Object.entries(corsHeaders(origin))) next.headers.set(key, value);
  return next;
}
function internalRequest(request: Request, roomId: string, suffix: "_create" | "_info"): Request {
  const headers = new Headers(request.headers); headers.set("X-Room-ID", roomId);
  return new Request(`https://room.internal/${suffix}`, { method: suffix === "_create" ? "POST" : "GET", headers });
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url); const origin = request.headers.get("Origin");
    const protectedMutation = (url.pathname === "/api/rooms" && request.method === "POST") || roomIdFromPath(url.pathname) !== undefined;
    if (url.pathname.startsWith("/api/") && origin !== null && !isAllowedOrigin(origin, url.hostname))
      return jsonError(403, "Origin is not allowed.", null);
    if (protectedMutation && origin === null) return jsonError(403, "An allowed Origin header is required.", null);
    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return new Response(null, { status: 204, headers: { ...corsHeaders(origin),
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400" } });
    }
    if (url.pathname === "/api/health" && request.method === "GET") return Response.json({ status: "ok" }, { headers: corsHeaders(origin) });
    if (url.pathname === "/api/rooms" && request.method === "POST") {
      const limited = await enforceRateLimit(env.ROOM_CREATION_LIMITER, request, origin);
      if (limited !== undefined) return limited;
      try {
        for (let attempt = 0; attempt < 12; attempt += 1) {
          const code = generateRoomCode();
          const response = await env.ROOMS.getByName(code).fetch(internalRequest(request, code, "_create"));
          if (response.status === 409) continue;
          if (!response.ok) return withCors(response, origin);
          return Response.json({ code, shareUrl: `${url.origin}/?room=${code}`, connectUrl: `/api/rooms/${code}/connect` },
            { status: 201, headers: { ...corsHeaders(origin), Location: `/api/rooms/${code}` } });
        }
      } catch { return multiplayerUnavailable(origin); }
      return jsonError(503, "Could not allocate a room code.", origin);
    }
    const infoRoomId = roomInfoIdFromPath(url.pathname);
    if (infoRoomId !== undefined && request.method === "GET") {
      const limited = await enforceRateLimit(env.ROOM_ACCESS_LIMITER, request, origin);
      if (limited !== undefined) return limited;
      try { return withCors(await env.ROOMS.getByName(infoRoomId).fetch(internalRequest(request, infoRoomId, "_info")), origin); }
      catch { return multiplayerUnavailable(origin); }
    }
    const roomId = roomIdFromPath(url.pathname);
    if (roomId !== undefined) {
      if (!isWebSocketUpgrade(request)) return jsonError(426, "Expected a GET WebSocket upgrade.", origin);
      const limited = await enforceRateLimit(env.ROOM_ACCESS_LIMITER, request, origin);
      if (limited !== undefined) return limited;
      const headers = new Headers(request.headers); headers.set("X-Room-ID", roomId);
      try { return await env.ROOMS.getByName(roomId).fetch(new Request(request, { headers })); }
      catch { return multiplayerUnavailable(origin); }
    }
    if (url.pathname.startsWith("/api/")) return jsonError(404, "API route not found.", origin);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

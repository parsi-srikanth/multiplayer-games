const ROOM_PATH = /^\/api\/rooms\/([a-z0-9][a-z0-9-]{2,63})\/connect$/;

export function roomIdFromPath(pathname: string): string | undefined {
  return ROOM_PATH.exec(pathname)?.[1];
}

export function isWebSocketUpgrade(request: Request): boolean {
  return request.method === "GET" && request.headers.get("Upgrade")?.toLowerCase() === "websocket";
}

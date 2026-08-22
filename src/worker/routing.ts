export const ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const ROOM_CODE = `[${ROOM_CODE_ALPHABET}]{5}`;
const CONNECT_PATH = new RegExp(`^/api/rooms/(${ROOM_CODE})/connect$`);
const INFO_PATH = new RegExp(`^/api/rooms/(${ROOM_CODE})$`);

export function roomIdFromPath(pathname: string): string | undefined { return CONNECT_PATH.exec(pathname)?.[1]; }
export function roomInfoIdFromPath(pathname: string): string | undefined { return INFO_PATH.exec(pathname)?.[1]; }
export function isWebSocketUpgrade(request: Request): boolean {
  return request.method === "GET" && request.headers.get("Upgrade")?.toLowerCase() === "websocket";
}
function secureRandomBytes(length: number): Uint8Array<ArrayBuffer> {
  const values = new Uint8Array(new ArrayBuffer(length));
  crypto.getRandomValues(values);
  return values;
}
export function generateRoomCode(randomBytes: (length: number) => Uint8Array = secureRandomBytes): string {
  const output: string[] = [];
  while (output.length < 5) {
    const bytes = randomBytes(8);
    for (const byte of bytes) {
      // Rejection sampling avoids modulo bias.
      const limit = Math.floor(256 / ROOM_CODE_ALPHABET.length) * ROOM_CODE_ALPHABET.length;
      if (byte < limit) output.push(ROOM_CODE_ALPHABET.charAt(byte % ROOM_CODE_ALPHABET.length));
      if (output.length === 5) break;
    }
  }
  return output.join("");
}
export function isAllowedOrigin(origin: string | null): boolean {
  if (origin === null) return true;
  if (origin === "https://games.srikanthparsi.com") return true;
  try {
    const url = new URL(origin);
    return (url.protocol === "http:" || url.protocol === "https:") && (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
  } catch { return false; }
}

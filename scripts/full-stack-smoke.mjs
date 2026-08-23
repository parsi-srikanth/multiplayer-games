import WebSocket from "ws";
const base = process.env.BASE_URL ?? "http://localhost:8787";
const origin = process.env.ORIGIN ?? (base.startsWith("https://") ? base : "https://games.srikanthparsi.com");
const wsBase = base.replace(/^http/, "ws");
const required = (condition, message) => { if (!condition) throw new Error(message); };
const health = await fetch(`${base}/api/health`); required(health.ok && (await health.json()).status === "ok", "health failed");
const home = await fetch(`${base}/`); required(home.ok && (await home.text()).includes("Parsi Games"), "assets failed");
const created = await fetch(`${base}/api/rooms`, { method: "POST", headers: { Origin: origin } });
required(created.status === 201, `room creation failed: ${created.status}`); const room = await created.json();
function connect(displayName) { return new Promise((resolve, reject) => { const ws = new WebSocket(`${wsBase}${room.connectUrl}`, { headers: { Origin: origin } }); const messages = []; ws.on("open", () => ws.send(JSON.stringify({ type: "client:hello", protocolVersion: 1, displayName }))); ws.on("error", reject); ws.on("message", (data) => { const message = JSON.parse(String(data)); messages.push(message); if (message.type === "server:hello") resolve({ ws, messages, hello: message }); }); }); }
function waitFor(client, predicate, label) { return new Promise((resolve, reject) => { const started = Date.now(); const tick = () => { const found = client.messages.find(predicate); if (found !== undefined) return resolve(found); if (Date.now() - started > 10_000) return reject(new Error(`${label} timed out`)); setTimeout(tick, 20); }; tick(); }); }
const host = await connect("Smoke Host"); const guest = await connect("Smoke Guest");
await waitFor(host, (message) => message.type === "room:state" && message.room.players.length === 2, "two-player admission");
host.ws.send(JSON.stringify({ type: "room:select_game", gameId: "tic-tac-toe-plus" }));
await waitFor(host, (message) => message.type === "room:state" && message.room.selectedGameId === "tic-tac-toe-plus", "game selection");
host.ws.send(JSON.stringify({ type: "room:start" }));
await waitFor(host, (message) => message.type === "room:state" && message.room.phase === "playing" && Array.isArray(message.room.game?.board), "game start");
host.ws.send(JSON.stringify({ type: "game:command", commandId: "release-smoke-1", command: { type: "place", index: 0 } }));
await waitFor(host, (message) => message.type === "server:ack" && message.commandId === "release-smoke-1", "command acknowledgement");
await waitFor(guest, (message) => message.type === "room:state" && message.room.game?.board?.[0] === host.hello.playerId, "viewer convergence");
host.ws.close(1000, "smoke complete"); guest.ws.close(1000, "smoke complete");
console.log(JSON.stringify({ health: "ok", assets: "ok", room: room.code, players: 2, game: "tic-tac-toe-plus", authoritativeMove: true }));

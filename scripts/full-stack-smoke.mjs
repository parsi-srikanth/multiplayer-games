import WebSocket from "ws";

const base = process.env.BASE_URL ?? "http://localhost:8787";
const origin = process.env.ORIGIN ?? (base.startsWith("https://") ? base : "https://games.srikanthparsi.com");
const wsBase = base.replace(/^http/, "ws");
const overallTimer = setTimeout(() => { console.error("full-stack smoke exceeded 30 seconds"); process.exit(1); }, 30_000);
const required = (condition, message) => { if (!condition) throw new Error(message); };
const fetchWithTimeout = (url, init = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });

const health = await fetchWithTimeout(`${base}/api/health`);
required(health.ok && (await health.json()).status === "ok", "health failed");
const home = await fetchWithTimeout(`${base}/`);
required(home.ok && (await home.text()).includes("Parsi Games"), "assets failed");
const created = await fetchWithTimeout(`${base}/api/rooms`, { method: "POST", headers: { Origin: origin } });
required(created.status === 201, `room creation failed: ${created.status}`);
const room = await created.json();

function connect(displayName, reconnectToken) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${wsBase}${room.connectUrl}`, { handshakeTimeout: 10_000, headers: { Origin: origin } });
    const messages = [];
    const timer = setTimeout(() => { ws.terminate(); reject(new Error(`${displayName} admission timed out`)); }, 10_000);
    const fail = (error) => { clearTimeout(timer); reject(error); };
    ws.once("error", fail);
    ws.once("close", (code) => { if (messages.length === 0) fail(new Error(`${displayName} closed before admission with code ${String(code)}`)); });
    ws.on("message", (data) => {
      const message = JSON.parse(String(data));
      messages.push(message);
      if (messages.length === 1 && message.type !== "server:hello") return fail(new Error(`${displayName} did not receive server:hello first`));
      if (message.type === "server:hello") {
        try {
          required(message.protocolVersion === 1, `${displayName} received the wrong protocol version`);
          required(message.roomId === room.code, `${displayName} received the wrong room ID`);
          required(typeof message.playerId === "string" && message.playerId.length > 0, `${displayName} received an empty player ID`);
          clearTimeout(timer);
          resolve({ ws, messages, hello: message });
        } catch (error) { ws.terminate(); fail(error); }
      }
    });
    ws.once("open", () => ws.send(JSON.stringify({ type: "client:hello", protocolVersion: 1, displayName, ...(reconnectToken === undefined ? {} : { reconnectToken }) })));
  });
}
function waitFor(client, predicate, label) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const found = client.messages.find(predicate);
      if (found !== undefined) return resolve(found);
      if (Date.now() - started > 10_000) return reject(new Error(`${label} timed out`));
      setTimeout(tick, 20);
    };
    tick();
  });
}
function closeCleanly(client) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { client.ws.terminate(); reject(new Error("clean close timed out")); }, 5_000);
    client.ws.once("error", (error) => { clearTimeout(timer); reject(error); });
    client.ws.once("close", (code) => { clearTimeout(timer); code === 1000 ? resolve() : reject(new Error(`unclean close code ${String(code)}`)); });
    client.ws.close(1000, "smoke complete");
  });
}
function waitForServerClose(client) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { client.ws.terminate(); reject(new Error("server close timed out")); }, 5_000);
    client.ws.once("error", (error) => { clearTimeout(timer); reject(error); });
    client.ws.once("close", (code) => { clearTimeout(timer); code === 1000 ? resolve() : reject(new Error(`unclean server close code ${String(code)}`)); });
  });
}

const host = await connect("Smoke Host");
let guest = await connect("Smoke Guest");
host.ws.send(JSON.stringify({ type: "client:ping", nonce: "release-smoke" }));
await waitFor(host, (message) => message.type === "server:pong" && message.nonce === "release-smoke", "ping/pong");
await waitFor(host, (message) => message.type === "room:state" && message.room.players.length === 2, "two-player admission");
host.ws.send(JSON.stringify({ type: "room:select_game", gameId: "tic-tac-toe-plus" }));
await waitFor(host, (message) => message.type === "room:state" && message.room.selectedGameId === "tic-tac-toe-plus", "game selection");
host.ws.send(JSON.stringify({ type: "room:start" }));
await waitFor(host, (message) => message.type === "room:state" && message.room.phase === "playing" && Array.isArray(message.room.game?.board), "game start");
host.ws.send(JSON.stringify({ type: "game:command", commandId: "release-smoke-1", command: { type: "place", index: 0 } }));
await waitFor(host, (message) => message.type === "server:ack" && message.commandId === "release-smoke-1", "command acknowledgement");
await waitFor(guest, (message) => message.type === "room:state" && message.room.game?.board?.[0] === host.hello.playerId, "viewer convergence");

guest.ws.terminate();
const reconnecting = await waitFor(host, (message) => message.type === "room:state" && message.room.players.some((player) => player.id === guest.hello.playerId && player.presence === "reconnecting"), "reconnecting presence");
const reconnectedGuest = await connect("Smoke Guest", guest.hello.reconnectToken);
required(reconnectedGuest.hello.playerId === guest.hello.playerId, "reconnect did not preserve player identity");
guest = reconnectedGuest;
await waitFor(host, (message) => message.type === "room:state" && message.room.revision > reconnecting.room.revision && message.room.players.some((player) => player.id === guest.hello.playerId && player.presence === "connected"), "reconnected presence");

async function move(client, index, commandId, viewer, expectedPlayerId) {
  client.ws.send(JSON.stringify({ type: "game:command", commandId, command: { type: "place", index } }));
  await waitFor(client, (message) => message.type === "server:ack" && message.commandId === commandId, `${commandId} acknowledgement`);
  await waitFor(viewer, (message) => message.type === "room:state" && message.room.game?.board?.[index] === expectedPlayerId, `${commandId} convergence`);
}
await move(guest, 4, "release-smoke-2", host, guest.hello.playerId);
await move(host, 1, "release-smoke-3", guest, host.hello.playerId);
await move(guest, 5, "release-smoke-4", host, guest.hello.playerId);
host.ws.send(JSON.stringify({ type: "game:command", commandId: "release-smoke-5", command: { type: "place", index: 2 } }));
await waitFor(host, (message) => message.type === "server:ack" && message.commandId === "release-smoke-5", "winning command acknowledgement");
await waitFor(guest, (message) => message.type === "room:state" && message.room.phase === "results" && message.room.results?.[0]?.playerId === host.hello.playerId, "terminal results convergence");
host.ws.send(JSON.stringify({ type: "room:return_lobby" }));
await waitFor(guest, (message) => message.type === "room:state" && message.room.phase === "lobby", "return to lobby");
const observer = await connect("Smoke Observer");
await waitFor(guest, (message) => message.type === "room:state" && message.room.players.length === 3, "three-player election setup");
const hostClose = waitForServerClose(host);
host.ws.send(JSON.stringify({ type: "room:leave" }));
await hostClose;
await waitFor(guest, (message) => message.type === "room:state" && message.room.players.length === 2 && message.room.viewer.isHost && message.room.players[0]?.id === guest.hello.playerId && message.room.players.some((player) => player.id === observer.hello.playerId && !player.isHost), "deterministic host election");
await Promise.all([closeCleanly(guest), closeCleanly(observer)]);
clearTimeout(overallTimer);
console.log(JSON.stringify({ health: "ok", assets: "ok", room: room.code, players: 3, helloFirst: true, pingPong: true, game: "tic-tac-toe-plus", completedGame: true, reconnect: true, synchronized: true, deterministicHostElection: true, cleanClose: true }));

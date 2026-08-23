# Deployment and rollback

> **Status:** release groundwork only. No successful production deployment or custom-domain verification is recorded here. Complete the evidence gates below during the first release.

## Prerequisites

- Node.js 22+ and the lockfile-compatible npm version.
- A Cloudflare API token scoped to the target account/zone with **Account / Workers Scripts / Edit**, **Zone / Workers Routes / Edit**, **DNS / Edit**, and **Zone / Read**.
- `games.srikanthparsi.com` in the intended Cloudflare zone.
- A clean `main` checkout at the reviewed release commit.

The current baseline has no application secrets. Do not add credentials to `wrangler.jsonc`, source, shell history, or release notes.

## Local full-stack verification

```bash
npm ci
npm run cf:typegen
npm run check
npm run deploy:dry-run
npx wrangler check startup
npm run dev:worker -- --local --port 8787
```

Keep Wrangler running, then execute the HTTP and WebSocket contract in another shell:

```bash
BASE_URL=http://127.0.0.1:8787 WS_URL=ws://127.0.0.1:8787 \
  bash -c '
    set -euo pipefail
    curl --fail --silent --show-error "$BASE_URL/api/health" | tee /tmp/parsi-health.json
    curl --fail --silent --show-error --output /tmp/parsi-index.html "$BASE_URL/"
    grep -qi "<!doctype html" /tmp/parsi-index.html
    BASE_URL="$BASE_URL" WS_URL="$WS_URL" node --input-type=module <<"NODE"
const room = `smoke-${Date.now()}`;
const ws = new WebSocket(`${process.env.WS_URL}/api/rooms/${room}/connect`);
const timeout = setTimeout(() => { console.error("websocket smoke timeout"); process.exit(1); }, 10_000);
let hello = false;
ws.addEventListener("message", ({ data }) => {
  const message = JSON.parse(String(data));
  if (!hello) {
    if (message.type !== "server:hello" || message.protocolVersion !== 1 || message.roomId !== room || typeof message.playerId !== "string") process.exit(1);
    hello = true;
    ws.send(JSON.stringify({ type: "client:ping", nonce: "release-smoke" }));
    return;
  }
  if (message.type !== "server:pong" || message.nonce !== "release-smoke") process.exit(1);
  clearTimeout(timeout);
  ws.close(1000, "smoke complete");
});
ws.addEventListener("error", () => process.exit(1));
ws.addEventListener("close", ({ code }) => {
  if (!hello || code !== 1000) process.exit(1);
  console.log("websocket smoke passed");
});
NODE
  '
```

Also inspect the Wrangler terminal after the clean close; delayed Durable Object callback errors fail the smoke. The expected health body is `{"status":"ok"}`. A `101` alone is insufficient: the socket must deliver `server:hello`, answer `client:ping` with the matching `server:pong`, and close with code `1000` without server errors.

## Production release

Run from the reviewed release commit:

```bash
set -euo pipefail
RELEASE_SHA="$(git rev-parse HEAD)"
test -z "$(git status --porcelain)"
git fetch origin main
test "$RELEASE_SHA" = "$(git rev-parse origin/main)"
npx wrangler whoami
npm ci
npm run cf:typegen
npm run check
npm run deploy:dry-run
npx wrangler check startup
VERSIONS_BEFORE="/tmp/parsi-games-versions-before-${RELEASE_SHA}.json"
VERSIONS_ERROR="/tmp/parsi-games-versions-before-${RELEASE_SHA}.stderr"
if npx wrangler versions list --json > "$VERSIONS_BEFORE" 2> "$VERSIONS_ERROR"; then
  rm -f "$VERSIONS_ERROR"
  echo "Captured the existing versions for rollback."
else
  versions_status=$?
  if grep -Eq 'workers\.api\.error\.script_not_found|\[code: 10090\]' "$VERSIONS_ERROR"; then
    printf '[]\n' > "$VERSIONS_BEFORE"
    echo "Wrangler positively reported that no prior Worker exists; rollback is unavailable for this first deployment."
  else
    cat "$VERSIONS_ERROR" >&2
    echo "Could not verify existing Worker versions; aborting without deployment." >&2
    exit "$versions_status"
  fi
fi
npx wrangler deploy --message "release ${RELEASE_SHA}"
npx wrangler versions list --json > "/tmp/parsi-games-versions-after-${RELEASE_SHA}.json"
```

Do not deploy if `main` moved, checks fail, Wrangler targets the wrong account, or the dry run shows unexpected routes, bindings, migrations, or assets. Preserve both version-list files in the release evidence.

## Live verification

Start a live error tail in one shell before exercising production:

```bash
npx wrangler tail parsi-games --status error
```

Keep that tail active. In a second shell, run immediately after deploy from a network outside the developer machine:

```bash
BASE_URL=https://games.srikanthparsi.com WS_URL=wss://games.srikanthparsi.com \
  bash -c '
    set -euo pipefail
    curl --fail --silent --show-error --proto "=https" --tlsv1.2 "$BASE_URL/api/health" | tee /tmp/parsi-live-health.json
    curl --fail --silent --show-error --proto "=https" --tlsv1.2 --output /tmp/parsi-live-index.html "$BASE_URL/"
    grep -qi "<!doctype html" /tmp/parsi-live-index.html
    BASE_URL="$BASE_URL" WS_URL="$WS_URL" node --input-type=module <<"NODE"
const room = `release-${Date.now()}`;
const ws = new WebSocket(`${process.env.WS_URL}/api/rooms/${room}/connect`);
const timeout = setTimeout(() => process.exit(1), 10_000);
let hello = false;
ws.addEventListener("message", ({ data }) => {
  const message = JSON.parse(String(data));
  if (!hello) {
    if (message.type !== "server:hello" || message.protocolVersion !== 1 || message.roomId !== room || typeof message.playerId !== "string") process.exit(1);
    hello = true;
    ws.send(JSON.stringify({ type: "client:ping", nonce: "live-smoke" }));
  } else {
    if (message.type !== "server:pong" || message.nonce !== "live-smoke") process.exit(1);
    clearTimeout(timeout);
    ws.close(1000, "live smoke complete");
  }
});
ws.addEventListener("error", () => process.exit(1));
ws.addEventListener("close", ({ code }) => { if (!hello || code !== 1000) process.exit(1); console.log("live websocket smoke passed"); });
NODE
  '
```

Keep the first shell's tail active throughout the smoke connection and close. Stop it with `Ctrl-C` after confirming no related errors. Separately verify in a mobile browser that the page loads over HTTPS without certificate or mixed-content warnings.

## Rollback

Rollback is available only when the pre-release version capture contains a known-good version. On the first deployment there is no prior Worker version to restore. If that initial release fails, remove or disable the new custom-domain route when safe, then use a reviewed forward-fix; do not invent a version ID or assume Durable Object data can be rolled back.

Choose the known-good version ID captured before release. Rollback changes Worker code immediately across routes, but **does not roll back Durable Object storage, class migrations, bindings, DNS, or other resources**.

```bash
set -euo pipefail
npx wrangler versions list --json
GOOD_VERSION_ID="REPLACE_WITH_CAPTURED_VERSION_ID"
test "$GOOD_VERSION_ID" != "REPLACE_WITH_CAPTURED_VERSION_ID"
npx wrangler rollback "$GOOD_VERSION_ID" --message "rollback after failed release" --yes
```

Repeat the full live verification contract after rollback. If a release changed Durable Object class lifecycle or incompatible stored data, stop and use the release-specific forward-fix/data recovery plan; Cloudflare may reject the rollback and code rollback cannot undo data.

## Release evidence gate

Replace every placeholder and attach links before marking production released:

- [ ] Release commit: `REPLACE_WITH_SHA`
- [ ] Wrangler version and account identity: `REPLACE_WITH_EVIDENCE_URL`
- [ ] `npm run check`, dry-run, and startup outputs: `REPLACE_WITH_EVIDENCE_URL`
- [ ] Deployed Worker version ID: `REPLACE_WITH_VERSION_ID`
- [ ] Previous known-good version ID: `REPLACE_WITH_VERSION_ID`
- [ ] HTTPS health/root output and timestamp: `REPLACE_WITH_EVIDENCE_URL`
- [ ] WSS hello/pong/clean-close output and error-tail review: `REPLACE_WITH_EVIDENCE_URL`
- [ ] Mobile HTTPS check: `REPLACE_WITH_DEVICE_AND_EVIDENCE_URL`
- [ ] Rollback owner and decision window: `REPLACE_WITH_OWNER_AND_WINDOW`

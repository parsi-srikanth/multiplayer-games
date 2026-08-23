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

Keep Wrangler running, then execute the maintained two-client contract in another shell:

```bash
BASE_URL=http://localhost:8787 npm run smoke:full-stack
```

The smoke verifies health and assets, creates a room through the rate-limited API, admits two independent WebSocket clients, selects and starts Tic-Tac-Toe+, submits a correlated authoritative move, and checks that the second viewer converges. Inspect the Wrangler terminal after clean socket closure; delayed Durable Object callback errors fail the smoke.

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
BASE_URL=https://games.srikanthparsi.com npm run smoke:full-stack
```

Keep the first shell's tail active throughout the two-client smoke and clean socket closure. Stop it after confirming no related errors. Separately verify in a mobile browser that the page loads over HTTPS without certificate or mixed-content warnings.

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

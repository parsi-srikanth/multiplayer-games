# Deployment and rollback

> **Status:** the first production deployment was verified on 2026-08-23. Follow this runbook for subsequent releases and preserve the evidence listed below.

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

The bounded smoke verifies health and assets, creates a room through the rate-limited API, admits two independent game clients, validates hello/ping/pong, selects and completes Tic-Tac-Toe+, reconnects one player with preserved identity, checks viewer convergence, admits a third election participant in the lobby, verifies deterministic host election after permanent departure, and requires clean socket closures. Inspect the Wrangler terminal after closure; delayed Durable Object callback errors fail the smoke.

Install Playwright's Chromium, Firefox, and WebKit browsers once, then run the maintained production browser matrix:

```bash
npx playwright install chromium firefox webkit
BASE_URL=https://games.srikanthparsi.com npm run smoke:browsers
```

This checks desktop Chromium/Firefox/WebKit, 320px Chromium portrait/landscape, and iPhone 13 WebKit portrait/landscape for HTTPS loading, console/page errors, horizontal overflow, axe violations, keyboard CTA focus, and create-room form usability. It is reproducible engine/viewport evidence, not a substitute for physical-device testing.

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

After a successful drill or resolved incident, restore the reviewed release version explicitly and repeat live verification:

```bash
RELEASE_VERSION_ID="REPLACE_WITH_REVIEWED_RELEASE_VERSION_ID"
test "$RELEASE_VERSION_ID" != "REPLACE_WITH_REVIEWED_RELEASE_VERSION_ID"
npx wrangler versions deploy "${RELEASE_VERSION_ID}@100%" --message "roll forward to reviewed release" --yes
BASE_URL=https://games.srikanthparsi.com npm run smoke:full-stack
BASE_URL=https://games.srikanthparsi.com npm run smoke:browsers
```

Do not leave a rollback drill serving the old version. Confirm the active deployment/version after roll-forward.

## Release evidence gate

Record these values for each release. The 2026-08-23 checkpoint evidence is consolidated in `CHECKPOINT.md` and the linked GitHub pull request rather than an external paid evidence store:

- [ ] Release source: merged checkpoint `ea9999971a295d89339dd6b7b81c3d2e856b2ca3`; record the release-hardening merge after review.
- [x] Wrangler account/zone access and Free Website zone plan verified without exposing credentials.
- [x] `npm run check`, zero-vulnerability audit, dry-run, and startup analysis passed.
- [ ] Record the new deployed version and previous known-good version in `CHECKPOINT.md` after release. The initial deployment currently has no earlier rollback version.
- [x] HTTPS health/root/assets and WSS full-stack contract passed publicly.
- [ ] Automated Chromium/Firefox/WebKit desktop and mobile-viewport matrix passed for the local release candidate; repeat publicly after deployment.
- [x] Rollback owner: repository owner; rollback window: immediately after a failed release, before incompatible storage migration or additional writes.
- [ ] Physical iOS Safari and Android Chrome evidence remains a manual follow-up and is not claimed by this checkpoint.

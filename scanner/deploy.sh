#!/usr/bin/env bash
# fivenines scanner auto-deploy (Proxmox box). Pulls the repo and syncs the scanner
# into /opt/shores. Never touches /opt/shores/.env, results/, or node_modules — those
# are box-local runtime state. Driven by cron so `git push` propagates to the box.
set -euo pipefail
REPO="${REPO:-/opt/fivenines-repo}"
APP="${APP:-/opt/shores}"

cd "$REPO"
before=$(git rev-parse HEAD)
git pull --quiet --ff-only
after=$(git rev-parse HEAD)

# copy only the scanner runtime files (cloudcheck.py is standalone, stdlib-only)
cp -f "$REPO/cloudcheck.py"      "$APP/cloudcheck.py"
cp -f "$REPO/scanner/scan.sh"    "$APP/scan.sh"
cp -f "$REPO/scanner/upload.mjs" "$APP/upload.mjs"
chmod +x "$APP/scan.sh" "$APP/cloudcheck.py"

[ "$before" = "$after" ] || echo "$(date -u +%FT%TZ) deployed $before -> $after"

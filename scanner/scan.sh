#!/usr/bin/env bash
# fivenines scanner — one full scan with worldwide Globalping probes (authenticated
# via GLOBALPING_TOKEN), then push results to Vercel Blob so the dashboard reads them.
# Runs on the Proxmox box from /opt/shores via the */30 cron.
cd /opt/shores || exit 1
[ -f /opt/shores/.env ] && { set -a; . /opt/shores/.env; set +a; }
/usr/bin/python3 cloudcheck.py --no-color --json \
  --globe 8 --locations "US,DE,GB,JP,SG,AU,BR,IN" \
  >/dev/null 2>>/var/log/shores-scan.err || true
/usr/bin/node /opt/shores/upload.mjs >/dev/null 2>>/var/log/shores-scan.err || true

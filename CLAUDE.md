# fivenines — cloud provider status suite

A multi-method cloud-provider uptime checker (`cloudcheck.py` / `check-status.sh`)
plus a Next.js dashboard (`web/`). See `README.md` for tool/usage details.
Live: **https://fivenines.vercel.app** · repo **github.com/fjbarrett/fivenines**.
(The Proxmox container, its `/opt/shores` path, and the `shores-data` Blob store
keep the old "shores" name internally — only the public brand changed.)

## Architecture (live)

Scans run on a home-lab Proxmox box; the dashboard runs on Vercel and reads the
scan data over HTTP from Vercel Blob. No inbound access to the home box.

```
Proxmox LXC 106 (/opt/shores)                    Vercel project "fivenines"
  cron */30  ->  scan.sh                            app reads (cache:no-store):
                 ├─ cloudcheck.py --globe 8           CLOUDCHECK_HISTORY_URL   ─┐
                 │    (Globalping authed via          CLOUDCHECK_SNAPSHOT_URL  ─┤
                 │     GLOBALPING_TOKEN)              CLOUDCHECK_REGIONS_BASE   ─┤
                 └─ upload.mjs (@vercel/blob put) ──────────► Vercel Blob ◄─────┘
                      shores/history.jsonl                    store "shores-data"
                      shores/latest.json                      (public, iad1)
                      shores/regions/<key>.json
```

- **Proxmox host:** `192.168.0.178` (PVE 9.1.1), SSH `root@192.168.0.178` (key `~/.ssh/id_ed25519`).
- **Container:** unprivileged Ubuntu 24.04 LXC **106**, `onboot=1`, at `/opt/shores`. Node 20 +
  Python 3.12, sshd key-only. IPv4 is **DHCP** (changes on reboot; was `.5`, currently
  `192.168.0.82`) — find it with `ssh root@192.168.0.178 'pct exec 106 -- ip -4 -o addr show eth0'`,
  or drive the box via the host with `pct exec 106 -- …`. IPv6 via SLAAC (`net0 ip6=auto`); the
  host needed `net.ipv6.conf.vmbr0.accept_ra=2` (`/etc/sysctl.d/99-ipv6-accept-ra.conf`).
- **Crons:** `*/30 * * * * /opt/shores/scan.sh` (scan + push) and
  `5,20,35,50 * * * * /opt/fivenines-repo/scanner/deploy.sh` (git-pull auto-deploy, below).
  Scan errors log to `/var/log/shores-scan.err`, deploys to `/var/log/fivenines-deploy.log`.
- **Secrets (box only, never in git):** `/opt/shores/.env` (mode 600) = `GLOBALPING_TOKEN` +
  `BLOB_READ_WRITE_TOKEN`. `cloudcheck.py` sends the Globalping token as a Bearer header.
- **Vercel:** project `fivenines`, **Root Directory `web`**, framework Next.js, Deployment
  Protection off. Blob store `shores-data` (public, host `ikq5jc5ovm0vi9d8`). Production env:
  `CLOUDCHECK_HISTORY_URL`, `CLOUDCHECK_SNAPSHOT_URL`, `CLOUDCHECK_REGIONS_BASE`,
  `BLOB_READ_WRITE_TOKEN`, `NEXT_PUBLIC_GA_ID` (GA4 `G-VD9NWJK6PP`). Domains: `fivenines.vercel.app`
  (primary) + `cloudshores.vercel.app` (old, still resolves).
- **App remote-read:** `web/lib/data.ts` fetches the Blob URLs when the env vars are set, else
  falls back to local `results/` (so `npm run dev` works). `POST /api/scan` is 501 in remote mode.

## CI/CD — `git push` deploys both targets

- **Vercel (web):** the GitHub repo is connected; pushing `main` auto-builds & deploys (PRs get
  preview URLs). Root Directory is `web`; an Ignored-Build-Step (`git diff --quiet HEAD^ HEAD -- .`)
  skips the build when `web/` didn't change.
- **Proxmox (scanner):** `/opt/fivenines-repo` is a clone of the repo; `scanner/deploy.sh` (cron,
  every 15 min) pulls and copies `cloudcheck.py` + `scanner/{scan.sh,upload.mjs}` into `/opt/shores`
  — never touching `.env`, `results/`, or `node_modules`. So a push reaches the box within ≤15 min.
- **Do NOT** run manual `vercel deploy` (Root Directory `web` would break a `--cwd web/` deploy) or
  `rsync` to the box — just commit and push.

## Notes

- **Chronic regions:** `cloudcheck.py` `load_chronic()` marks a region/component down in ≥~half of
  recent run snapshots as "chronic" (e.g. Cloudflare's permanently re-routed PoPs) and excludes it
  from the live outage count; a feed-`minor` explained entirely by chronic re-routing no longer
  forces DEGRADED. Real/new outages still count.
- **Region history:** `upload.mjs` derives per-provider region timelines into `shores/regions/<key>.json`
  for the `/provider/[key]/region` pages. GCP "regions" are products (listed only during incidents).
- **Providers (16):** AWS, GCP, Azure, Cloudflare, DigitalOcean, Oracle, Linode, Vercel, IBM, Alibaba,
  Tencent, OVH, Meta, ByteDance, **Anthropic** (status.claude.com), **OpenAI**.

## Git — ALWAYS

- Public repo `github.com/fjbarrett/fivenines`, branch `main`. Focused commits per logical change;
  push (which now deploys). Never commit `.env*`, `web/.vercel/`, tokens, or `results/` (all gitignored).

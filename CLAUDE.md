# fivenines — cloud provider status suite

A multi-method cloud-provider uptime checker (`cloudcheck.py` / `check-status.sh`)
plus a Next.js dashboard (`web/`). See `README.md` for tool/usage details.
Live: **https://fivenines.vercel.app** · repo **github.com/fjbarrett/fivenines**.
(The Proxmox container and its `/opt/shores` path keep the old "shores" name
internally — only the public brand changed.)

## Architecture (live)

Scans run on a home-lab Proxmox box; the dashboard runs on Vercel. Both read/write
a **self-hosted Postgres on a DigitalOcean droplet** (the old Vercel Blob store
`shores-data` was billing-suspended and is decommissioned). No inbound to the home box.

```
Proxmox LXC 106 (/opt/shores)                  DO droplet "postgres" (sfo3)      Vercel "fivenines"
  cron */30  ->  scan.sh                        209.38.79.145:5432 (TLS+scram)    app reads (force-dynamic):
                 ├─ cloudcheck.py --globe 8       db "fivenines"                    web/lib/db.ts -> pg Pool
                 │    (Globalping via             ┌─ table history  ◄──────────────  readRows()
                 │     GLOBALPING_TOKEN)          ├─ table snapshots ◄─────────────  readLatestSnapshot()
                 └─ upload.mjs (pg upsert) ──────►┘  (regions derived from last 90  readRegionFile()
                    DATABASE_URL                      snapshots on read)
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
  `DATABASE_URL`. `cloudcheck.py` sends the Globalping token as a Bearer header. The box needs
  the `pg` npm package in `/opt/shores/node_modules` (deploy.sh does NOT run npm install — install
  deps manually once: `pct exec 106 -- bash -lc 'cd /opt/shores && npm install pg'`).
- **Database:** DO droplet **`postgres`** (`209.38.79.145`, sfo3, shared with other apps), SSH
  `frank@209.38.79.145` (passwordless sudo). Postgres 16, port 5432 still open at the firewall
  (ufw `Anywhere`), `pg_hba` = `hostssl ... scram-sha-256` (non-SSL rejected, self-signed cert).
  Dedicated role+db `fivenines`. Schema in `db/schema.sql` (tables `history`, `snapshots`).
  `DATABASE_URL` has **no** `?sslmode=`; TLS is **pinned** in code (`ssl:{ca:POSTGRES_CA,
  rejectUnauthorized:true, checkServerIdentity:()=>undefined}`) — CA is the server's public cert in
  `web/lib/db-ca.ts` (mirrored in `scanner/upload.mjs`), **expires 2027-03-29** (rotation cmd in
  that file). **pg_hba hardening (2026-06-17 security review):** remote `postgres` superuser is
  `reject`ed (admin via local peer only); the `fivenines` role is scoped to the `fivenines` db
  (`hostssl all fivenines 0.0.0.0/0 reject` for every other db) so a leaked cred can't pivot to
  the other tenants; `PUBLIC CONNECT` on the `fivenines` db is revoked (only the `fivenines` role
  connects). Backup at `/etc/postgresql/16/main/pg_hba.conf.bak.20260617`. **Still open:** port
  5432 is internet-reachable (needs Vercel Secure Compute/static-egress on a Pro plan to allowlist),
  and `appuser`/`markus` are not yet db-scoped (ownership: appuser→{appdb,ipsuite,keep},
  markus→markus_downley — left on the catch-all to avoid breaking those apps unverified).
- **Vercel:** project `fivenines`, **Root Directory `web`**, framework Next.js, Deployment
  Protection off. Production env: `DATABASE_URL`, `NEXT_PUBLIC_GA_ID` (GA4 `G-VD9NWJK6PP`).
  `DATABASE_URL` is also set for Development; Preview was blocked by a CLI bug (54.13.0) — add via
  dashboard if PR previews need data. Domains: `fivenines.vercel.app` (primary) +
  `cloudshores.vercel.app` (old, still resolves). **Security headers** (CSP/HSTS/X-Frame-Options
  etc.) are set in `web/next.config.ts` (CSP allows GA inline via `'unsafe-inline'`). **WAF:** one
  custom rate-limit rule `ratelimit-dynamic` (120 req/60s/IP, deny excess) on `/api`+`/provider`
  (`vercel firewall rules list`); Hobby plan caps it at a single rate-limit rule. Read paths use
  60s ISR/CDN caching (not `force-dynamic`) to cap droplet load.
- **App read:** `web/lib/data.ts` queries Postgres when `DATABASE_URL` is set, else falls back to
  local `results/` (so `npm run dev` works offline). `POST /api/scan` is 501 in remote mode.

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
- **Region history:** per-provider region timelines for the `/provider/[key]/region` pages are
  derived **on read** (`web/lib/data.ts` `readRegionFile`) from the last 90 `snapshots` rows — no
  longer precomputed/stored. GCP "regions" are products (listed only during incidents).
- **Providers (16):** AWS, GCP, Azure, Cloudflare, DigitalOcean, Oracle, Linode, Vercel, IBM, Alibaba,
  Tencent, OVH, Meta, ByteDance, **Anthropic** (status.claude.com), **OpenAI**.

## Git — ALWAYS

- Public repo `github.com/fjbarrett/fivenines`, branch `main`. Focused commits per logical change;
  push (which now deploys). Never commit `.env*`, `web/.vercel/`, tokens, or `results/` (all gitignored).

// Push scan data to the self-hosted DigitalOcean Postgres so the dashboard can
// read it. Run after each scan. Idempotent + self-seeding: re-running backfills
// anything missing.
//   table history    flat per-provider rows (from results/history.jsonl)
//   table snapshots  full per-run snapshot (from results/runs/<id>.json)
// (Region timelines are derived on read from the last 90 snapshots — no longer
//  precomputed here.)
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const root = '/opt/shores';
const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }

// Pinned PUBLIC self-signed cert for the DO Postgres (209.38.79.145), mirror of
// web/lib/db-ca.ts. Verifies the TLS chain so a MITM can't impersonate the DB and
// harvest credentials. The cert is CN=<ip> with no IP SAN, so the (redundant)
// hostname check is skipped. ROTATION: expires 2027-03-29 — refresh both copies
// from `openssl s_client -starttls postgres -connect 127.0.0.1:5432 | openssl x509`.
const POSTGRES_CA = `-----BEGIN CERTIFICATE-----
MIIDETCCAfmgAwIBAgIUaH6iy0m1LERJtp+jAOtiZhCb+oAwDQYJKoZIhvcNAQEL
BQAwGDEWMBQGA1UEAwwNMjA5LjM4Ljc5LjE0NTAeFw0yNjAzMjkxNDM3MjJaFw0y
NzAzMjkxNDM3MjJaMBgxFjAUBgNVBAMMDTIwOS4zOC43OS4xNDUwggEiMA0GCSqG
SIb3DQEBAQUAA4IBDwAwggEKAoIBAQCUF832I4GhSr4SqTCCLRV3C5dmcTcMf4SA
kI506g2bSVPLI+jGIFzJxtGHnDj8BDTadeMe09fhYsW9hwj90/XZh6ZQEWBjiVWu
YDolRU7mLYFT3x1ppb0BLPjOmnlQGl/Je3Ag/QNpengBkdJ/nIzePOGEYeVJJzdm
vS6fN6vJQLlb4E2vG/6crpY4jWtoy+9Vz1lwcXXKW5kgQZJTfeX7eTlWw7KGPFho
Qwaf9AoILoWlHP4pa1idK8hnfrl/ByVuobSTJ397e348UkZvOQ7UQYPjhODPHsC4
LC4dU+sCaBsfleDt1Hje7K5AHq4f33bbNPX272AGhKkne0x/I5flAgMBAAGjUzBR
MB0GA1UdDgQWBBRHENZKL0DfppmvGWxfUZbpMYaAcDAfBgNVHSMEGDAWgBRHENZK
L0DfppmvGWxfUZbpMYaAcDAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3DQEBCwUA
A4IBAQA+n4XC+ZCDnQ3sn6ornY9Uo0ak2uD5BK1F3bDaO3cB/eOwaXBN0V9OXUp3
7tljKN258LYMvqzOyxddxUTW5ADKfRcqJqqhXIJNbIwKWxm5oGKra+3QH0v2/Ndn
8ulElm6PtCFIr2P/YnRIdmQhhPcmZ1gs3V1ks5Nx0krnCIEemOGuRgLRP2YY3XLj
bYqRmCQqxOmkPU33cS3hqDutBFnjUPGSuxeV+EJPGk8wq4XlwJ3V0KVN6k5EJHLw
yZCMHgslQYx2572w/SjZtfzu9kltjpCQXqkL1i0Z53kV2bVLOs1WjcC94cZe9mnG
aniQ/md1Lv52NIZAw15XAda0xFVZ
-----END CERTIFICATE-----
`;

const pool = new pg.Pool({
  connectionString: url,
  ssl: { ca: POSTGRES_CA, rejectUnauthorized: true, checkServerIdentity: () => undefined },
  max: 2,
});

try {
  // 1) flat history rows — one batched upsert of the whole file (small),
  //    ON CONFLICT DO NOTHING so re-runs only add genuinely new rows.
  const histText = await readFile(path.join(root, 'results/history.jsonl'), 'utf8').catch(() => '');
  const rows = [];
  for (const line of histText.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      const r = JSON.parse(t);
      if (r.checked_at && r.provider) rows.push(r);
    } catch { /* skip malformed line */ }
  }
  let histNew = 0;
  if (rows.length) {
    const res = await pool.query(
      `INSERT INTO history (checked_at, provider, row)
       SELECT x->>'checked_at', x->>'provider', x
       FROM jsonb_array_elements($1::jsonb) AS x
       ON CONFLICT (checked_at, provider) DO NOTHING`,
      [JSON.stringify(rows)]
    );
    histNew = res.rowCount;
  }

  // 2) run snapshots — upsert the latest always, plus any of the last 90 not
  //    yet stored (keeps the DB in sync / self-seeds without re-sending all 90).
  const runsDir = path.join(root, 'results/runs');
  const runFiles = (await readdir(runsDir)).filter(f => f.endsWith('.json')).sort();
  const recent = runFiles.slice(-90);
  const { rows: existing } = await pool.query('SELECT checked_at FROM snapshots');
  const have = new Set(existing.map(r => r.checked_at));
  const latestFile = recent.at(-1); // filename ids use dashes; checked_at uses colons
  let snapN = 0;
  for (const f of recent) {
    let data;
    try { data = JSON.parse(await readFile(path.join(runsDir, f), 'utf8')); } catch { continue; }
    if (!data.checked_at) continue;
    if (have.has(data.checked_at) && f !== latestFile) continue; // stored already; only refresh newest
    await pool.query(
      `INSERT INTO snapshots (checked_at, vantage, data)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (checked_at) DO UPDATE SET vantage = EXCLUDED.vantage, data = EXCLUDED.data`,
      [data.checked_at, data.vantage ?? null, JSON.stringify(data)]
    );
    snapN++;
  }

  console.log(`history: +${histNew} new rows (of ${rows.length}); snapshots upserted: ${snapN}`);
} finally {
  await pool.end();
}

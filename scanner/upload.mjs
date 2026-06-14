// Push scan data to Vercel Blob so the dashboard can read it. Run after each scan.
//   shores/history.jsonl   flat history (all runs)
//   shores/latest.json     newest full snapshot (per-region detail)
//   shores/regions/<key>.json   per-provider region history (timeline per region)
import { put } from '@vercel/blob';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = '/opt/shores';
const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) { console.error('BLOB_READ_WRITE_TOKEN not set'); process.exit(1); }

async function up(pathname, body, contentType) {
  const { url } = await put(pathname, body, {
    access: 'public', token, addRandomSuffix: false, allowOverwrite: true, contentType,
  });
  return url;
}

console.log('HISTORY_URL=' + await up('shores/history.jsonl',
  await readFile(path.join(root, 'results/history.jsonl')), 'application/x-ndjson'));

const runsDir = path.join(root, 'results/runs');
const runFiles = (await readdir(runsDir)).filter(f => f.endsWith('.json')).sort();
if (runFiles.length) {
  console.log('SNAPSHOT_URL=' + await up('shores/latest.json',
    await readFile(path.join(runsDir, runFiles.at(-1))), 'application/json'));
}

// per-provider region history from the last 90 snapshots
const snaps = [];
for (const f of runFiles.slice(-90)) {
  try { snaps.push(JSON.parse(await readFile(path.join(runsDir, f), 'utf8'))); } catch {}
}
const byProvider = new Map();
for (const snap of snaps) {            // oldest -> newest
  const t = snap.checked_at;
  for (const r of snap.results || []) {
    const reg = r.regions;
    if (!reg || reg.error || !reg.items?.length) continue;
    let acc = byProvider.get(r.key);
    if (!acc) { acc = { provider: r.key, name: r.name, kind: reg.kind, regions: {} }; byProvider.set(r.key, acc); }
    acc.name = r.name; acc.kind = reg.kind;
    for (const it of reg.items) {
      const e = (acc.regions[it.name] ||= { chronic: false, status: '', points: [] });
      e.points.push({ t, ok: !!it.ok });
      e.chronic = !!it.chronic;        // newest snapshot wins
      e.status = it.status || '';
    }
  }
}
let n = 0;
for (const [key, acc] of byProvider) {
  acc.generatedAt = new Date().toISOString();
  await up(`shores/regions/${key}.json`, JSON.stringify(acc), 'application/json');
  n++;
}
console.log('REGION_FILES=' + n + ' base=https://ikq5jc5ovm0vi9d8.public.blob.vercel-storage.com/shores/regions');

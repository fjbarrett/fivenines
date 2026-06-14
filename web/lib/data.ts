// Server-only: locate and read the scan history written by the scripts.
import { promises as fs } from "fs";
import path from "path";
import { aggregate } from "./aggregate";
import type { Row, ProviderDetail, Dashboard } from "./aggregate";

// Project root holding the scripts + results/. Defaults to the parent of the
// web app (so `npm run dev` inside web/ finds ../results). Override with
// CLOUDCHECK_ROOT, or point straight at the file with CLOUDCHECK_DATA.
export function projectRoot(): string {
  return process.env.CLOUDCHECK_ROOT || path.resolve(process.cwd(), "..");
}

export function historyPath(): string {
  return process.env.CLOUDCHECK_DATA || path.join(projectRoot(), "results", "history.jsonl");
}

// Fetch text over HTTP — used when scans are read from a remote store (the
// Proxmox box pushes history.jsonl + latest snapshot to Vercel Blob).
async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

export async function readRows(): Promise<Row[]> {
  const url = process.env.CLOUDCHECK_HISTORY_URL;
  const text = url
    ? await fetchText(url)
    : await fs.readFile(historyPath(), "utf8").catch(() => null);
  if (text == null) return []; // no scans available yet
  const rows: Row[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      rows.push(JSON.parse(trimmed) as Row);
    } catch {
      // skip a malformed/partial line rather than failing the whole dashboard
    }
  }
  return rows;
}

// The newest per-run snapshot holds the full nested detail (regions, per-endpoint
// HTTP, DoH answers, globe probes) that the flat history can't carry.
export async function readLatestSnapshot(): Promise<{
  checked_at: string;
  vantage: string;
  results: ProviderDetail[];
} | null> {
  const url = process.env.CLOUDCHECK_SNAPSHOT_URL;
  if (url) {
    const text = await fetchText(url);
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
  const dir = path.join(projectRoot(), "results", "runs");
  let files: string[];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch {
    return null;
  }
  if (files.length === 0) return null;
  files.sort(); // run ids are ISO timestamps -> lexical sort = chronological
  const latest = files[files.length - 1];
  try {
    return JSON.parse(await fs.readFile(path.join(dir, latest), "utf8"));
  } catch {
    return null;
  }
}

// Build the aggregated dashboard and attach the full per-provider detail from
// the newest snapshot. Shared by the API routes and the provider pages.
export async function getDashboard(): Promise<Dashboard> {
  const rows = await readRows();
  const agg = aggregate(rows);
  const snap = await readLatestSnapshot();
  if (snap) {
    const byKey = new Map(snap.results.map((d) => [d.key, d]));
    for (const p of agg.providers) p.detail = byKey.get(p.key) ?? null;
  }
  return agg;
}

// --- per-region history --------------------------------------------------- //
// Produced by the Proxmox uploader (one file per provider) so each region gets
// its own timeline, mirroring the provider history.
export interface RegionPoint {
  t: string;
  ok: boolean;
}
export interface RegionEntry {
  chronic: boolean;
  status: string;
  points: RegionPoint[];
}
export interface RegionFile {
  provider: string;
  name: string;
  kind: string;
  generatedAt?: string;
  regions: Record<string, RegionEntry>;
}

export async function readRegionFile(key: string): Promise<RegionFile | null> {
  const base = process.env.CLOUDCHECK_REGIONS_BASE;
  if (base) {
    const text = await fetchText(`${base}/${encodeURIComponent(key)}.json`);
    if (!text) return null;
    try {
      return JSON.parse(text) as RegionFile;
    } catch {
      return null;
    }
  }
  return buildRegionFileFromFs(key); // local dev: reconstruct from results/runs
}

async function buildRegionFileFromFs(key: string): Promise<RegionFile | null> {
  const dir = path.join(projectRoot(), "results", "runs");
  let files: string[];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return null;
  }
  const out: RegionFile = { provider: key, name: key, kind: "", regions: {} };
  let found = false;
  for (const f of files.slice(-90)) {
    let snap: { checked_at: string; results: ProviderDetail[] };
    try {
      snap = JSON.parse(await fs.readFile(path.join(dir, f), "utf8"));
    } catch {
      continue;
    }
    const r = snap.results?.find((x) => x.key === key);
    const reg = r?.regions;
    if (!r || !reg || reg.error || !reg.items?.length) continue;
    found = true;
    out.name = r.name;
    out.kind = reg.kind;
    for (const it of reg.items) {
      const e = (out.regions[it.name] ??= { chronic: false, status: "", points: [] });
      e.points.push({ t: snap.checked_at, ok: !!it.ok });
      e.chronic = !!it.chronic;
      e.status = it.status || "";
    }
  }
  return found ? out : null;
}

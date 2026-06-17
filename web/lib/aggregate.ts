// Pure aggregation of the append-only scan history into a dashboard model.
// No Node APIs here so it is safe to share types with client components.

export type State = "UP" | "DEGRADED" | "DOWN" | "UNKNOWN";

export interface Row {
  checked_at: string;
  provider: string;
  name: string;
  state: State;
  status_state: string;
  status_detail: string;
  http_ok: number;
  http_codes: string;
  dns_ok: number;
  dns_v4: number | null;
  dns_v6: number | null;
  doh_views: number | null;
  ipv6_ok: number | null;
  globe_up: number | string | null;
  globe_total: number | string | null;
  regions_up: number | string | null;
  regions_total: number | string | null;
  vantage: string;
  note: string;
  latency_ms?: number | string | null; // representative edge RTT (newer scans)
  reason?: string; // per-scan evidence behind the verdict (newer scans)
}

// Full nested record from results/runs/<id>.json (written by cloudcheck.py).
export interface RegionItem {
  name: string;
  status: string;
  ok: boolean;
  ms?: number | null; // probe RTT (probe-kind regions)
  chronic?: boolean; // down in ~every recent scan (persistently re-routed); not counted as a live outage
  local_only?: boolean; // failed from our box but reachable via Globalping — a local path issue, not a regional outage
}
export interface IncidentUpdate {
  at: string | null;
  status: string;
  body: string;
}
export interface Incident {
  id: string;
  name: string;
  impact: string; // none | minor | major | critical | maintenance (or gcp high/medium/low)
  status: string; // resolved | monitoring | identified | investigating | ongoing
  started_at: string | null;
  resolved_at: string | null;
  components: string[];
  updates: IncidentUpdate[];
}
export interface ProviderDetail {
  key: string;
  name: string;
  page: string;
  state: State;
  headline?: string;
  note?: string;
  status: { state: string; detail: string; line: string };
  http: { ok: boolean; ms?: number | null; endpoints: Record<string, { ok: boolean; code: number; note: string; ms?: number | null }> };
  dns: {
    ok: boolean;
    host: string;
    v4: string[];
    v6: string[];
    doh: Record<string, string[]>;
    perspectives: number;
  };
  ipv6: { ok: boolean; host: string };
  tls?: { host: string; expiry_days: number | null };
  globe:
    | { up: number; total: number; p50_ms?: number | null; probes: { country: string; city: string; net: string; code: number | null; ok: boolean; ms?: number | null }[]; error?: string }
    | null;
  regions: { kind: string; up: number; total: number; real_down?: number; chronic?: number; items: RegionItem[]; error?: string; note?: string } | null;
  incidents?: Incident[];
}

export interface HistoryPoint {
  checked_at: string;
  state: State;
  regionsUp: number | null;
  regionsTotal: number | null;
  headline: string;
  note: string;
}

export interface ProviderAgg {
  key: string;
  name: string;
  current: Row; // .state is the debounced (effective) state; other fields are the raw latest scan
  rawState: State; // the latest single scan's unsmoothed state
  pending: boolean; // latest scan disagrees with the confirmed state (a change awaiting confirmation)
  counts: Record<State, number>;
  uptimePct: number;
  samples: number;
  regionsUp: number | null;
  regionsTotal: number | null;
  latencyMs: number | null; // current representative edge RTT
  latencyBaselineMs: number | null; // median RTT over the window (null until enough samples)
  latencyRegressed: boolean; // current RTT well above baseline
  history: HistoryPoint[];
  detail?: ProviderDetail | null;
}

export interface RunAgg {
  checked_at: string;
  up: number;
  degraded: number;
  down: number;
  unknown: number;
  total: number;
}

export interface Dashboard {
  generatedAt: string;
  lastScan: string | null;
  totalRuns: number;
  totalRecords: number;
  summary: { up: number; degraded: number; down: number; unknown: number; total: number };
  regions: { up: number; total: number };
  providers: ProviderAgg[];
  runs: RunAgg[];
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const STATES: State[] = ["UP", "DEGRADED", "DOWN", "UNKNOWN"];
// Sort order so anything wrong floats to the top of the grid.
const SEVERITY: Record<State, number> = { DOWN: 0, DEGRADED: 1, UNKNOWN: 2, UP: 3 };

function normState(s: unknown): State {
  return STATES.includes(s as State) ? (s as State) : "UNKNOWN";
}

// A displayed state only changes after CONFIRM consecutive identical raw scans,
// so a single flaky scan (UP, DOWN, UP) never flips the dashboard. Applied
// symmetrically — recovery is confirmed the same way. The raw per-scan state is
// preserved in the DB; this only smooths what the dashboard reports.
const CONFIRM = 2;
function smoothStates(raw: State[]): State[] {
  const eff: State[] = [];
  let cur: State = raw[0] ?? "UNKNOWN";
  let runVal: State | null = null;
  let runLen = 0;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === runVal) runLen++;
    else { runVal = raw[i]; runLen = 1; }
    if (i === 0) cur = raw[0];
    else if (runVal !== cur && runLen >= CONFIRM) cur = runVal;
    eff.push(cur);
  }
  return eff;
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

export function aggregate(rows: Row[]): Dashboard {
  const sorted = [...rows]
    .map((r) => ({ ...r, state: normState(r.state) }))
    .sort((a, b) => a.checked_at.localeCompare(b.checked_at));

  // --- per provider -------------------------------------------------------
  const byProvider = new Map<string, Row[]>();
  for (const r of sorted) {
    const arr = byProvider.get(r.provider) ?? [];
    arr.push(r);
    byProvider.set(r.provider, arr);
  }

  const providers: ProviderAgg[] = [];
  for (const [key, list] of byProvider) {
    // Debounce over the *full* ordered history so the carry-forward is correct
    // at the window edge, then take the displayed window. eff[i] is the
    // confirmed state at scan i; the raw state stays on the row for the detail.
    const eff = smoothStates(list.map((r) => r.state));
    const effList = list.map((r, i) => ({ ...r, state: eff[i] }));

    // Uptime, counts, and the timeline all reflect the same rolling window
    // (the displayed last-90 scans) so the headline % can't drift from the
    // graph or imply more history than we actually show.
    const window = effList.slice(-90);
    const counts: Record<State, number> = { UP: 0, DEGRADED: 0, DOWN: 0, UNKNOWN: 0 };
    for (const r of window) counts[r.state]++;
    const current = effList[effList.length - 1]; // .state is debounced; other fields raw
    const rawLast = list[list.length - 1];
    const pending = !!rawLast && current.state !== rawLast.state;

    // Latency baseline: median RTT over the window; flag the current scan when it
    // runs well above it (needs a few samples before a baseline is meaningful).
    const latVals = window
      .map((r) => toNum(r.latency_ms))
      .filter((v): v is number => v !== null);
    const latencyMs = toNum(rawLast.latency_ms);
    const latencyBaselineMs = latVals.length >= 8 ? median(latVals) : null;
    const latencyRegressed =
      latencyMs !== null &&
      latencyBaselineMs !== null &&
      latencyMs > Math.max(latencyBaselineMs * 2, latencyBaselineMs + 150);

    providers.push({
      key,
      name: current.name || key,
      current,
      rawState: rawLast.state,
      pending,
      counts,
      samples: window.length,
      uptimePct: window.length ? (counts.UP / window.length) * 100 : 0,
      regionsUp: toNum(current.regions_up),
      regionsTotal: toNum(current.regions_total),
      latencyMs,
      latencyBaselineMs,
      latencyRegressed,
      history: window.map((r) => ({
        checked_at: r.checked_at,
        state: r.state,
        regionsUp: toNum(r.regions_up),
        regionsTotal: toNum(r.regions_total),
        // prefer the per-scan evidence ("13/16 regions down") over the feed's
        // generic detail ("no machine-readable feed") for reach providers
        headline: r.reason || r.status_detail || "",
        note: r.note || "",
      })),
    });
  }
  providers.sort(
    (a, b) =>
      SEVERITY[a.current.state] - SEVERITY[b.current.state] ||
      a.name.localeCompare(b.name)
  );

  // --- per run (scan) -----------------------------------------------------
  const byRun = new Map<string, RunAgg>();
  for (const r of sorted) {
    const run = byRun.get(r.checked_at) ?? {
      checked_at: r.checked_at, up: 0, degraded: 0, down: 0, unknown: 0, total: 0,
    };
    run.total++;
    if (r.state === "UP") run.up++;
    else if (r.state === "DEGRADED") run.degraded++;
    else if (r.state === "DOWN") run.down++;
    else run.unknown++;
    byRun.set(r.checked_at, run);
  }
  const runs = [...byRun.values()]
    .sort((a, b) => b.checked_at.localeCompare(a.checked_at))
    .slice(0, 60);

  // --- top-line summary uses each provider's *latest* state ---------------
  const summary = { up: 0, degraded: 0, down: 0, unknown: 0, total: providers.length };
  const regions = { up: 0, total: 0 };
  for (const p of providers) {
    if (p.current.state === "UP") summary.up++;
    else if (p.current.state === "DEGRADED") summary.degraded++;
    else if (p.current.state === "DOWN") summary.down++;
    else summary.unknown++;
    if (p.regionsTotal !== null) {
      regions.total += p.regionsTotal;
      regions.up += p.regionsUp ?? 0;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    lastScan: runs[0]?.checked_at ?? null,
    totalRuns: byRun.size,
    totalRecords: rows.length,
    summary,
    regions,
    providers,
    runs,
  };
}

import Link from "next/link";
import type { Incident, ProviderAgg, State } from "@/lib/aggregate";
import { ProviderLogo } from "@/lib/provider-logos";

export const TONE: Record<State, { dot: string; text: string; badge: string; stroke: string }> = {
  UP: {
    dot: "bg-emerald-400",
    text: "text-emerald-400",
    badge: "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/30",
    stroke: "stroke-emerald-400",
  },
  DEGRADED: {
    dot: "bg-amber-400",
    text: "text-amber-400",
    badge: "bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/30",
    stroke: "stroke-amber-400",
  },
  DOWN: {
    dot: "bg-rose-500",
    text: "text-rose-400",
    badge: "bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/30",
    stroke: "stroke-rose-500",
  },
  UNKNOWN: {
    dot: "bg-slate-500",
    text: "text-slate-400",
    badge: "bg-slate-500/10 text-slate-300 ring-1 ring-slate-500/30",
    stroke: "stroke-slate-500",
  },
};

// Which providers belong on the CDN page vs. the main platforms page. Anything
// not listed defaults to "cloud" (shown on the main page).
const CATEGORY: Record<string, "cloud" | "ai" | "cdn"> = {
  cloudflare: "cdn",
  akamai: "cdn",
  bunny: "cdn",
  anthropic: "ai",
  openai: "ai",
};
export const categoryOf = (key: string): "cloud" | "ai" | "cdn" => CATEGORY[key] ?? "cloud";
export const isCdn = (key: string) => categoryOf(key) === "cdn";

// Retired providers whose historical rows still linger in the data but should no
// longer surface in the UI.
const HIDDEN = new Set<string>(["meta"]);
export const isHidden = (key: string) => HIDDEN.has(key);

export function Nav({ active }: { active: "platforms" | "cdn" }) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link
      href={href}
      className={
        on
          ? "rounded-full bg-white/10 px-3 py-1 font-medium text-slate-100"
          : "rounded-full px-3 py-1 text-slate-500 transition hover:text-slate-200"
      }
    >
      {label}
    </Link>
  );
  return (
    <nav className="mb-6 flex items-center gap-1 text-sm">
      {tab("/", "Platforms", active === "platforms")}
      {tab("/cdn", "CDNs", active === "cdn")}
    </nav>
  );
}

// Formats an uptime percentage compactly: "100%", "99.98%", "98.1%".
function fmtUptime(pct: number): string {
  if (pct >= 99.995) return "100%";
  if (pct <= 0) return "0%";
  return `${pct.toFixed(2).replace(/\.?0+$/, "")}%`;
}

// A static circular gauge whose arc length is the uptime % and whose color is the
// current state. Replaces the old pulsing dot.
function UptimeRing({ pct, stroke }: { pct: number; stroke: string }) {
  const r = 11;
  const c = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <svg viewBox="0 0 28 28" className="h-3.5 w-3.5 -rotate-90" aria-hidden="true">
      <circle cx="14" cy="14" r={r} fill="none" strokeWidth="3" className="stroke-white/10" />
      <circle
        cx="14"
        cy="14"
        r={r}
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        className={stroke}
        strokeDasharray={`${filled} ${c}`}
      />
    </svg>
  );
}

// Minimal: logo, name, and an uptime ring (gauge filled by recent uptime %,
// colored by current state) with the percentage beside it.
export function ProviderCard({ p }: { p: ProviderAgg }) {
  const t = TONE[p.current.state];
  const label = `${p.current.state} · ${fmtUptime(p.uptimePct)} uptime over last ${p.samples} checks`;
  return (
    <Link
      href={`/provider/${p.key}`}
      className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-white/20 hover:bg-white/[0.04]"
    >
      <ProviderLogo keyId={p.key} />
      <h3 className="min-w-0 flex-1 truncate font-medium text-slate-100">{p.name}</h3>
      <div className="flex shrink-0 items-center gap-2" title={label} aria-label={label}>
        <span className={`h-2 w-2 shrink-0 rounded-full ${t.dot}`} />
      </div>
    </Link>
  );
}

function impactRank(impact: string): number {
  const m: Record<string, number> = {
    critical: 3, major: 3, high: 3, minor: 1, medium: 1, low: 0, maintenance: 0, none: 0,
  };
  return m[impact.toLowerCase()] ?? 1;
}

// Surfaces only a *major* ongoing incident (critical/major/high impact) among the
// given providers as a banner. Minor degradations don't get a banner.
export function TopIncident({ providers }: { providers: ProviderAgg[] }) {
  let best: { p: ProviderAgg; inc: Incident; score: number } | null = null;
  for (const p of providers) {
    for (const inc of p.detail?.incidents ?? []) {
      if (inc.status === "resolved" || inc.resolved_at) continue; // ongoing only
      const score = impactRank(inc.impact);
      if (
        !best ||
        score > best.score ||
        (score === best.score && (inc.started_at ?? "") > (best.inc.started_at ?? ""))
      ) {
        best = { p, inc, score };
      }
    }
  }
  if (!best || best.score < 3) return null; // major / critical only
  const t = TONE.DOWN;
  return (
    <Link
      href={`/provider/${best.p.key}/incident/${encodeURIComponent(best.inc.id)}`}
      className={`mb-6 flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl px-4 py-3 transition hover:brightness-110 ${t.badge}`}
    >
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${t.dot}`} />
      <span className="font-medium">{best.p.name}</span>
      <span className="font-mono text-[10px] uppercase tracking-wide opacity-80">{best.inc.impact}</span>
      <span className="min-w-0 flex-1 truncate text-sm opacity-90">{best.inc.name}</span>
      <span className="font-mono text-xs opacity-70">ongoing</span>
    </Link>
  );
}

// Dead-man's switch: scans run every 30 min, so data older than ~45 min means
// the scanner (or its upload to Postgres) is likely down. Surface it loudly —
// otherwise a frozen dashboard reads as "everything's fine".
const STALE_MS = 45 * 60 * 1000;
const VERY_STALE_MS = 2 * 60 * 60 * 1000;

function staleAge(iso: string | null): string {
  if (!iso) return "never";
  const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ${m % 60}m` : `${Math.floor(h / 24)}d`;
}

export function StaleBanner({ lastScan }: { lastScan: string | null }) {
  const ageMs = lastScan ? Date.now() - new Date(lastScan).getTime() : Infinity;
  if (ageMs <= STALE_MS) return null;
  const t = ageMs > VERY_STALE_MS ? TONE.DOWN : TONE.DEGRADED;
  return (
    <div className={`mb-6 flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl px-4 py-3 ${t.badge}`}>
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${t.dot}`} />
      <span className="font-medium">Scan data is stale</span>
      <span className="min-w-0 flex-1 text-sm opacity-90">
        Last successful scan was {staleAge(lastScan)} ago (scans run every 30 min) — the scanner or its
        upload is likely down, so the statuses below may not reflect reality.
      </span>
    </div>
  );
}

export function ProviderGrid({ providers }: { providers: ProviderAgg[] }) {
  return (
    <section className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(20rem,100%),1fr))]">
      {providers.map((p) => (
        <ProviderCard key={p.key} p={p} />
      ))}
    </section>
  );
}

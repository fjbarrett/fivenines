import Link from "next/link";
import type { Incident, ProviderAgg, State } from "@/lib/aggregate";
import { ProviderLogo } from "@/lib/provider-logos";

export const TONE: Record<State, { dot: string; text: string; badge: string }> = {
  UP: {
    dot: "bg-emerald-400",
    text: "text-emerald-400",
    badge: "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/30",
  },
  DEGRADED: {
    dot: "bg-amber-400",
    text: "text-amber-400",
    badge: "bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/30",
  },
  DOWN: {
    dot: "bg-rose-500",
    text: "text-rose-400",
    badge: "bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/30",
  },
  UNKNOWN: {
    dot: "bg-slate-500",
    text: "text-slate-400",
    badge: "bg-slate-500/10 text-slate-300 ring-1 ring-slate-500/30",
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

export function Nav({ active }: { active: "platforms" | "cdns" }) {
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
      {tab("/cdns", "CDNs", active === "cdns")}
    </nav>
  );
}

// Minimal: logo, name, and a pulsing status "blinker" whose color is the state.
export function ProviderCard({ p }: { p: ProviderAgg }) {
  const t = TONE[p.current.state];
  return (
    <Link
      href={`/provider/${p.key}`}
      className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-white/20 hover:bg-white/[0.04]"
    >
      <ProviderLogo keyId={p.key} />
      <h3 className="min-w-0 flex-1 truncate font-medium text-slate-100">{p.name}</h3>
      <span
        className="relative flex h-2.5 w-2.5 shrink-0"
        title={p.current.state}
        aria-label={p.current.state}
      >
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${t.dot}`} />
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${t.dot}`} />
      </span>
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

export function ProviderGrid({ providers }: { providers: ProviderAgg[] }) {
  return (
    <section className="grid gap-8 grid-cols-[repeat(auto-fill,minmax(min(20rem,100%),1fr))]">
      {providers.map((p) => (
        <ProviderCard key={p.key} p={p} />
      ))}
    </section>
  );
}

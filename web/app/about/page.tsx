import Link from "next/link";

export const metadata = { title: "about · 9s" };

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 lg:px-12">
      <Link
        href="/"
        className="font-mono text-sm text-slate-500 transition hover:text-slate-300"
      >
        ← back
      </Link>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-slate-100">About</h1>

      <div className="mt-5 space-y-4 text-sm leading-relaxed text-slate-400">
        <p>
          <span className="text-slate-200">Availability</span> is an independent dashboard that
          tracks whether the major cloud platforms are up — and tells you, at a glance, when
          they&rsquo;re not.
        </p>
        <p>
          Every provider publishes its own status, but they live in a dozen different places and
          formats. This site brings them together into one view, so you can answer a single
          question fast: <span className="text-slate-200">is it them, or is it me?</span>
        </p>
        <p>
          Each provider gets a card that stays calm when healthy and lights up when something is
          wrong. Open any provider to see per-region and per-component health, ongoing incidents
          with timelines, and a rolling history of state changes. Regions that are persistently
          re-routed are recognized and set aside, so a handful of permanently maintenance-mode
          edge nodes don&rsquo;t masquerade as an outage.
        </p>
        <p>
          Availability is not affiliated with any of the providers it monitors, and what it shows
          may differ from what you&rsquo;re seeing on your own connection.
        </p>
      </div>
    </div>
  );
}

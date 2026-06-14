import Link from "next/link";

export const metadata = { title: "About" };

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

      <div className="mt-5 space-y-4 text-lg leading-relaxed text-slate-300">
        <p>
          <span className="text-slate-100">FiveNines Availability</span> is an
          independent dashboard that pulls every major cloud platform&rsquo;s status into one
          view, so you can answer a single question fast:{" "}
          <span className="text-slate-100">is it them, or is it me?</span>
        </p>
        <p>
          It&rsquo;s not affiliated with any of the providers it monitors, and what it shows may
          differ from what you&rsquo;re seeing on your own connection.
        </p>
      </div>
    </div>
  );
}

# Domain ideas for fivenines

The brand plays on **"five nines" = 99.999 % uptime** — the classic SRE
reliability target. That makes almost every obvious spelling desirable (and,
as it turns out, mostly already registered). This file tracks candidate
domains and a snapshot of their availability.

> **Availability snapshot: 2026-06-14.** Method: `dig` (an A/NS record ⇒
> definitely registered) corroborated by `whois` (a "No match" / "Domain not
> found" ⇒ likely available). This is a *signal*, not a purchase guarantee —
> registered-but-unconfigured domains have no DNS, and premium/registry-held
> names can show as "available" yet cost hundreds. **Always confirm the real
> price at a registrar before celebrating.** Re-run `bash /tmp/domcheck.sh
> <domain>` style probes to refresh.

## ✅ Looks available

| Domain              | Notes |
|---------------------|-------|
| **getfivenines.com** | Exact brand on a `.com` via the `get-` prefix — the safe, cheap, conventional SaaS choice (~$10–13/yr). Strongest practical pick. |
| **fivenines.me**     | Exact brand, short TLD. `.me` reads fine for a product ("fivenines.me"). ~$20/yr renewal. |
| **fivenines.sh**     | Exact brand on a shell-flavored TLD — on-theme for a dev/ops tool (same registry family as `.io`). Pricier, ~$40–60/yr. |

## ❌ Taken (resolves / registered)

Exact spelling, all gone: **fivenines** `.com .io .dev .app .net .org .co .cloud
.tech .xyz .live`.

Numeric / leet variants, all gone: **5nines** `.com .io .dev .net`, **five9s**
`.com .io .dev`, **5n.io**, **99999.io**, **fivenine.com**.

Shorter plays, all gone: **nines** `.io .dev`, **thenines.io**, **nin.es**.

### The `.es` domain hacks — sadly taken
`fivenines` splits beautifully as `fivenin` + `.es` (Spain's ccTLD), reading as
one word: **fivenin.es**. Likewise **5nin.es** = "5nines". Both already resolve
to live A records, so the cleanest hacks are unavailable. (Kept here because
they're the best *idea* if either ever drops — worth a backorder/watch.)

## Not yet probed (ideas for a future pass)

- **fivenines** on niche/cheap TLDs: `.site .online .space .pro .systems .tools
  .observer .monitor` (no `.monitor`/`.status` gTLD exists), `.fyi`, `.report`.
- Descriptive prefixes/suffixes on `.com`: `tryfivenines`, `fivenineshq`,
  `fiveninesapp`, `fivenines.io`-style `useful`/`hq` combos.
- Uptime-themed siblings (different name entirely): `nines.fyi`, `99dot999.com`,
  `allnines.io`, `chasingnines.com`.

## Recommendation

1. **getfivenines.com** — buy this now as the canonical, cheap, no-surprises
   home. `get-` prefixes are an accepted SaaS convention and it's a true `.com`.
2. **fivenines.me** — grab as a short, exact-brand redirect if the budget allows.
3. Set a **drop-watch / backorder on `fivenin.es`** — if it ever lapses, the hack
   is the most memorable option of all.
4. Until then, the site stays on the free **fivenines.vercel.app** (current live
   URL) — no domain purchase is blocking anything.

// Server-only: shared Postgres pool for reading scan data from the self-hosted
// DigitalOcean Postgres (db "fivenines"). Returns null when DATABASE_URL is
// unset so local dev can fall back to reading results/ off disk.
import { Pool } from "pg";
import { POSTGRES_CA } from "./db-ca";

// Reuse a single pool across hot-reloads (dev) and warm Fluid Compute instances
// (prod) instead of opening one per request — the droplet is small and shared.
const g = globalThis as unknown as { __fiveninesPool?: Pool };

export function getPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  if (!g.__fiveninesPool) {
    g.__fiveninesPool = new Pool({
      connectionString,
      // The server presents a self-signed cert. Pin it (verify the chain against
      // our embedded copy) so a network MITM can't impersonate the DB and harvest
      // credentials. The cert is CN=<ip> with no IP SAN, so Node's hostname check
      // would reject it even though the CA matches — pinning the exact CA already
      // prevents MITM, so the (redundant) hostname check is skipped.
      ssl: { ca: POSTGRES_CA, rejectUnauthorized: true, checkServerIdentity: () => undefined },
      max: 3,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return g.__fiveninesPool;
}

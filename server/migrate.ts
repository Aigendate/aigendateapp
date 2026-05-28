#!/usr/bin/env node
// Apply Drizzle migrations. Prefers DIRECT_URL (port 5432, direct Postgres)
// over DATABASE_URL when both are set — Supabase's pgbouncer transaction
// pooler (port 6543) breaks advisory locks and some DDL the migrator relies
// on. Falls back to DATABASE_URL for environments that only set the one var.

import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

async function main() {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Neither DIRECT_URL nor DATABASE_URL is set");
  }
  const usingDirect = !!process.env.DIRECT_URL;
  console.log(`[migrate] using ${usingDirect ? "DIRECT_URL" : "DATABASE_URL"}`);

  const pool = new pg.Pool({ connectionString });
  const db = drizzle(pool);
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migrations applied.");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

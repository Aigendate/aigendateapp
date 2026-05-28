#!/usr/bin/env node
// Create the test database (if it doesn't exist) and apply all migrations to it.
// Reads DATABASE_URL_TEST from the environment; if unset, defaults to the same
// host as DATABASE_URL with database name "<original>_test".

import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

function deriveTestUrl(): string {
  if (process.env.DATABASE_URL_TEST) return process.env.DATABASE_URL_TEST;
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("Set DATABASE_URL or DATABASE_URL_TEST in .env");
  const u = new URL(base);
  u.pathname = `/${u.pathname.replace(/^\//, "").split("?")[0]}_test`;
  return u.toString();
}

async function ensureDatabase(testUrl: string) {
  const u = new URL(testUrl);
  const dbName = u.pathname.replace(/^\//, "").split("?")[0];
  const adminUrl = new URL(testUrl);
  adminUrl.pathname = "/postgres";

  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (exists.rows.length === 0) {
    // pg_escape the DB name; it's controlled by us but be paranoid anyway.
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(dbName)) {
      throw new Error(`Refusing to CREATE DATABASE with unsafe name: ${dbName}`);
    }
    await admin.query(`CREATE DATABASE "${dbName}"`);
    console.log(`Created database "${dbName}".`);
  } else {
    console.log(`Database "${dbName}" already exists.`);
  }
  await admin.end();
}

async function main() {
  const testUrl = deriveTestUrl();
  console.log(`Test DB target: ${testUrl.replace(/:[^@/]+@/, ":***@")}`);

  await ensureDatabase(testUrl);

  const pool = new pg.Pool({ connectionString: testUrl });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
  await pool.end();

  console.log(
    `\nDone. Add this to your .env (or .env.test):\n  DATABASE_URL_TEST="${testUrl}"`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

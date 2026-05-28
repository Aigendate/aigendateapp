import pg from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

type Db = NodePgDatabase<typeof schema> & { $pool: pg.Pool };

declare global {
  // eslint-disable-next-line no-var
  var __db: Db | undefined;
  // eslint-disable-next-line no-var
  var __pool: pg.Pool | undefined;
}

function createClient(): Db {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const pool = new pg.Pool({ connectionString });
  globalThis.__pool = pool;
  const client = drizzle(pool, { schema }) as unknown as Db;
  client.$pool = pool;
  return client;
}

function getClient(): Db {
  if (!globalThis.__db) {
    globalThis.__db = createClient();
  }
  return globalThis.__db;
}

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    return Reflect.get(getClient(), prop);
  },
}) as Db;

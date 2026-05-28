#!/usr/bin/env node
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./client";

async function main() {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$pool.end();
  });

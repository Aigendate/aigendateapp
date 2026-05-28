#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { db } from "./server/client";
import { appointments, doctors, hospitals, patients } from "./server/schema";
import { insertHospital } from "./server/db";

async function main() {
  await db.delete(appointments);
  await db.delete(doctors);
  await db.delete(patients);
  await db.delete(hospitals);
  console.log("Cleared existing data.");

  const csvPaths = [
    path.join(process.cwd(), "data", "osm_facilities.csv"),
    path.join(process.cwd(), "scraper", "data", "osm_facilities.csv"),
  ];

  let csvPath: string | null = null;
  for (const p of csvPaths) {
    if (existsSync(p)) {
      csvPath = p;
      break;
    }
  }

  if (!csvPath) {
    console.error("No osm_facilities.csv found. Run `npm run scrape` first.");
    process.exit(1);
  }

  console.log(`Reading: ${csvPath}`);
  const csvContent = readFileSync(csvPath, "utf-8");
  const lines = csvContent.split("\n").slice(1).filter((l) => l.trim());

  let inserted = 0;
  let skipped = 0;

  for (const line of lines) {
    const cols = line.split(",");
    const name = cols[2]?.trim() || cols[3]?.trim();
    const facilityType = cols[4]?.trim();
    const city = cols[12]?.trim().replace(/^"|"$/g, "");
    const street = cols[13]?.trim().replace(/^"|"$/g, "");
    const lat = parseFloat(cols[14]);
    const lon = parseFloat(cols[15]);

    if (facilityType !== "hospital" || !name) {
      skipped++;
      continue;
    }
    if (isNaN(lat) || isNaN(lon)) {
      skipped++;
      continue;
    }

    const parts = [street, city, "Paraguay"].filter(Boolean);
    const address = parts.join(", ");
    await insertHospital({ name, address, lat, lng: lon });
    inserted++;
  }

  const [totalRow] = await db.select({ c: sql<number>`count(*)::int` }).from(hospitals);
  console.log(`\nInserted: ${inserted} hospitals`);
  console.log(`Skipped: ${skipped} non-hospital rows`);
  console.log(`Total in DB: ${totalRow.c} hospitals`);

  const sample = await db
    .select({ name: hospitals.name, address: hospitals.address, lat: hospitals.lat, lng: hospitals.lng })
    .from(hospitals)
    .limit(10);
  console.log("\nSample hospitals:");
  for (const h of sample) {
    console.log(`  ${h.name} | ${h.address} | ${h.lat}, ${h.lng}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$pool.end();
  });

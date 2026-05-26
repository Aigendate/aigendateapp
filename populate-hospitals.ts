#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { initDb, insertHospital } from "./server/db";

const dbPath = path.join(process.cwd(), "turnos.db");
const db = initDb(dbPath);

db.prepare("DELETE FROM appointments").run();
db.prepare("DELETE FROM doctors").run();
db.prepare("DELETE FROM patients").run();
db.prepare("DELETE FROM hospitals").run();
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
  insertHospital(db, { name, address, lat, lng: lon });
  inserted++;
}

const total = (db.prepare("SELECT COUNT(*) as n FROM hospitals").get() as { n: number }).n;
console.log(`\nInserted: ${inserted} hospitals`);
console.log(`Skipped: ${skipped} non-hospital rows`);
console.log(`Total in DB: ${total} hospitals`);

const sample = db.prepare("SELECT name, address, lat, lng FROM hospitals LIMIT 10").all() as { name: string; address: string; lat: number; lng: number }[];
console.log("\nSample hospitals:");
for (const h of sample) {
  console.log(`  ${h.name} | ${h.address} | ${h.lat}, ${h.lng}`);
}

db.close();